// @vitest-environment node

import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  down,
  planContentDocument,
  scanRemovePostsCategories,
  up,
} from '@/migrations/20261120_remove_posts_categories'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const archive = { blockType: 'pageArchive', populateBy: 'collection', relationTo: 'posts' }
const post = { relationTo: 'posts', value: 'post-id' }
const category = { relationTo: 'categories', value: 'category-id' }

describe('Remove Posts and Categories document planner', () => {
  it('finds ordinary, Lexical, and inactive Archive references by their precise paths', () => {
    const plan = planContentDocument(
      {
        _id: 'page',
        layout: [
          { ...archive, populateBy: 'selection', categories: ['category-id'] },
          { ...archive, selectedDocs: [post] },
          {
            blockType: 'pageContent',
            link: { reference: category },
            richText: {
              root: {
                children: [
                  { type: 'link', fields: { doc: post } },
                  { type: 'relationship', ...category },
                ],
              },
            },
          },
        ],
      },
      'pages',
    )

    expect(plan.references).toEqual([
      { path: 'layout.0.categories.0', target: 'categories', kind: 'archive' },
      { path: 'layout.1.selectedDocs.0', target: 'posts', kind: 'archive' },
      { path: 'layout.2.link.reference', target: 'categories', kind: 'relationship' },
      {
        path: 'layout.2.richText.root.children.0.fields.doc',
        target: 'posts',
        kind: 'relationship',
      },
      { path: 'layout.2.richText.root.children.1', target: 'categories', kind: 'relationship' },
    ])
  })

  it('plans only collection-populated Archives with the retired collection selector', () => {
    const plan = planContentDocument(
      {
        _id: 'version',
        version: {
          layout: [
            archive,
            { ...archive, blockType: 'archive', categories: [] },
            { ...archive, populateBy: 'selection' },
            { ...archive, relationTo: 'blogs', categories: ['blog-category'] },
            { ...archive, blockType: 'pageContent' },
          ],
        },
      },
      '_pages_versions',
    )

    expect(plan.archiveChanges.map(({ path }) => path)).toEqual([
      'version.layout.0',
      'version.layout.1',
    ])
    expect(plan.references).toEqual([
      { path: 'version.layout.4', target: 'posts', kind: 'relationship' },
    ])
  })
})

describe('Remove Posts and Categories MongoDB migration', () => {
  const databaseName = 'ecolitea2-test-remove-posts-categories'
  const databaseURI = createIsolatedTestDatabaseURI(databaseName)
  let payload: Payload
  let adapter: MongooseAdapter

  const db = () => adapter.connection.db!
  const collection = (name: string) =>
    db().collection<{ _id: string; [key: string]: unknown }>(name)
  const args = () => ({ payload, req: { payload } as PayloadRequest })
  const readCollections = async () => {
    const namespaces = await db().listCollections({}, { nameOnly: true }).toArray()
    return Object.fromEntries(
      await Promise.all(
        namespaces.map(async ({ name }) => [
          name,
          await collection(name).find().sort({ _id: 1 }).toArray(),
        ]),
      ),
    )
  }

  beforeAll(async () => {
    console.info(`Migration test target: ${databaseURI}; storage disabled, no uploads`)
    payload = await getPayload({
      key: databaseName,
      disableOnInit: true,
      config: buildConfig({
        db: mongooseAdapter({
          url: databaseURI,
          connectOptions: { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 3000 },
        }),
        secret: 'isolated-remove-posts-categories-migration-test-secret',
        telemetry: false,
        typescript: { autoGenerate: false },
      }),
    })
    adapter = payload.db as MongooseAdapter
  }, 15000)

  beforeEach(async () => {
    await db().dropDatabase()
  })

  afterAll(async () => {
    if (adapter) {
      console.info(`Migration test cleanup: ${databaseURI}; storage disabled`)
      await db().dropDatabase()
      await payload.destroy()
    }
  })

  it('reports legacy documents, retained and orphaned versions, and references across the preflight sources', async () => {
    await collection('posts').insertOne({ _id: 'post-id', slug: 'post-slug', _status: 'draft' })
    await collection('categories').insertOne({ _id: 'category-id', slug: 'category-slug' })
    await collection('_posts_versions').insertMany([
      { _id: 'retained', parent: 'post-id', version: {} },
      { _id: 'orphaned', parent: 'deleted', version: {} },
    ])
    await collection('_categories_versions').insertOne({
      _id: 'orphan-category',
      parent: 'deleted',
    })
    const contentSources = [
      'pages',
      'blogs',
      'case-studies',
      'products',
      'product-categories',
      'blog-categories',
    ]
    for (const name of contentSources) {
      await collection(name).insertOne({ _id: name, link: { reference: post } })
      await collection(`_${name}_versions`).insertOne({
        _id: name,
        version: { link: { reference: category } },
      })
    }
    const globalTypes = ['header', 'footer', 'settings', 'site-settings']
    await collection('globals').insertMany(
      globalTypes.map((globalType) => ({
        _id: globalType,
        globalType,
        link: { reference: post },
      })),
    )
    await collection('globals').insertOne({
      _id: 'other',
      globalType: 'other',
      link: { reference: post },
    })
    await collection('_settings_versions').insertOne({
      _id: 'settings-version',
      version: { link: { reference: category } },
    })
    await collection('redirects').insertMany([
      { _id: 'old-redirect', to: { type: 'custom', reference: post } },
      { _id: 'blog-redirect', to: { reference: { relationTo: 'blogs', value: 'blog-id' } } },
    ])
    await collection('translations').insertMany([
      { _id: 'post-en', sourceCollection: 'posts' },
      { _id: 'category-en', sourceCollection: 'categories' },
      { _id: 'blog-en', sourceCollection: 'blogs' },
    ])

    const { report } = await scanRemovePostsCategories(db())

    expect(report.blockers).toMatchObject({
      documents: [
        { collection: 'posts', id: 'post-id', slug: 'post-slug', status: 'draft' },
        { collection: 'categories', id: 'category-id', slug: 'category-slug' },
      ],
      redirects: [
        { collection: 'redirects', id: 'old-redirect', path: 'to.reference', target: 'posts' },
      ],
      translations: [
        {
          collection: 'translations',
          id: 'category-en',
          path: 'sourceCollection',
          target: 'categories',
        },
        { collection: 'translations', id: 'post-en', path: 'sourceCollection', target: 'posts' },
      ],
    })
    expect(report.blockers.relationships).toHaveLength(18)
    expect(report.blockers.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          collection: '_products_versions',
          id: 'products',
          path: 'version.link.reference',
          target: 'categories',
        }),
        expect.objectContaining({
          collection: 'globals',
          id: 'site-settings',
          globalType: 'site-settings',
          path: 'link.reference',
          target: 'posts',
        }),
        expect.objectContaining({
          collection: '_settings_versions',
          id: 'settings-version',
          path: 'version.link.reference',
        }),
        {
          collection: 'globals',
          id: 'other',
          globalType: 'other',
          path: 'link.reference',
          target: 'posts',
        },
      ]),
    )
    expect(report.versions).toEqual({
      _posts_versions: {
        retained: [{ id: 'retained', parent: 'post-id' }],
        orphaned: [{ id: 'orphaned', parent: 'deleted' }],
      },
      _categories_versions: {
        retained: [],
        orphaned: [{ id: 'orphan-category', parent: 'deleted' }],
      },
    })
  })

  it('blocks rich-text references in media captions, form confirmations, and their versions', async () => {
    await collection('media').insertOne({
      _id: 'photo',
      caption: { root: { children: [{ type: 'link', fields: { doc: post } }] } },
    })
    await collection('_forms_versions').insertOne({
      _id: 'form-version',
      version: {
        confirmationMessage: {
          root: { children: [{ type: 'relationship', relationTo: 'categories' }] },
        },
      },
    })
    await collection('forms').insertOne({
      _id: 'form',
      confirmationMessage: {
        root: { children: [{ type: 'link', fields: { doc: { relationTo: 'posts' } } }] },
      },
    })
    await collection('search').insertOne({ _id: 'stale-search', doc: post })
    await collection('translation-search').insertOne({ _id: 'stale-translation', doc: post })
    const before = await readCollections()

    const { report } = await scanRemovePostsCategories(db())
    expect(report.blockerCounts.relationships).toBe(3)
    expect(report.blockers.relationships).toEqual([
      {
        collection: '_forms_versions',
        id: 'form-version',
        path: 'version.confirmationMessage.root.children.0',
        target: 'categories',
      },
      {
        collection: 'forms',
        id: 'form',
        path: 'confirmationMessage.root.children.0.fields.doc',
        target: 'posts',
      },
      {
        collection: 'media',
        id: 'photo',
        path: 'caption.root.children.0.fields.doc',
        target: 'posts',
      },
    ])
    await expect(up(args())).rejects.toThrow(/blocked/i)
    expect(await readCollections()).toEqual(before)
  })

  it('refuses an inactive Archive reference before any document update, index removal, or drop', async () => {
    await db().createCollection('posts')
    await collection('_posts_versions').insertOne({ _id: 'orphan', parent: 'deleted' })
    await collection('pages').insertOne({ _id: 'page', layout: [archive] })
    await collection('_pages_versions').insertOne({
      _id: 'version',
      version: { layout: [{ ...archive, populateBy: 'selection', categories: ['category-id'] }] },
    })
    await collection('search').insertOne({ _id: 'old-index', doc: post })
    const before = await readCollections()

    await expect(up(args())).rejects.toThrow(/blocked.*version\.layout\.0\.categories\.0/i)
    expect(await readCollections()).toEqual(before)
  })

  it('updates only eligible Archives and retired indexes, drops retired namespaces, and supports a retry', async () => {
    await db().createCollection('posts')
    await db().createCollection('categories')
    await db().createCollection('_categories_versions')
    await collection('_posts_versions').insertOne({ _id: 'orphan', parent: 'deleted' })
    const selectedArchive = { ...archive, populateBy: 'selection' }
    const blogDoc = { relationTo: 'blogs', value: 'blog-id' }
    const blogArchive = {
      ...archive,
      relationTo: 'blogs',
      categories: ['blog-category'],
      selectedDocs: [blogDoc],
    }
    await collection('pages').insertOne({
      _id: 'page',
      layout: [archive, selectedArchive, blogArchive],
      title: 'Page',
    })
    await collection('_pages_versions').insertOne({
      _id: 'version',
      version: { layout: [archive] },
    })
    await collection('search').insertMany([
      { _id: 'post-index', doc: post },
      { _id: 'blog-index', doc: blogDoc },
      { _id: 'product-index', doc: { relationTo: 'products', value: 'product-id' } },
    ])
    await collection('translation-search').insertMany([
      { _id: 'post-en', sourceCollection: 'posts' },
      { _id: 'blog-en', sourceCollection: 'blogs' },
    ])
    const originalBlog = { _id: 'blog-id', title: 'Blog' }
    await collection('blogs').insertOne(originalBlog)

    const { report } = await scanRemovePostsCategories(db())
    expect(report.blockerCount).toBe(0)
    expect(report.planned).toEqual({
      archiveBlocks: 2,
      searchRows: 1,
      translationSearchRows: 1,
      collections: ['posts', 'categories', '_posts_versions', '_categories_versions'],
    })
    await up(args())
    const migrated = await readCollections()

    expect(migrated).toEqual({
      pages: [
        {
          _id: 'page',
          layout: [{ ...archive, relationTo: 'blogs' }, selectedArchive, blogArchive],
          title: 'Page',
        },
      ],
      _pages_versions: [
        { _id: 'version', version: { layout: [{ ...archive, relationTo: 'blogs' }] } },
      ],
      search: [
        { _id: 'blog-index', doc: blogDoc },
        { _id: 'product-index', doc: { relationTo: 'products', value: 'product-id' } },
      ],
      'translation-search': [{ _id: 'blog-en', sourceCollection: 'blogs' }],
      blogs: [originalBlog],
    })
    await up(args())
    expect(await readCollections()).toEqual(migrated)

    await down(args())
    const rolledBack = await readCollections()
    expect(rolledBack).toEqual({
      ...migrated,
      pages: [{ _id: 'page', layout: [archive, selectedArchive, blogArchive], title: 'Page' }],
      _pages_versions: [{ _id: 'version', version: { layout: [archive] } }],
    })
    await down(args())
    expect(await readCollections()).toEqual(rolledBack)
  })
})
