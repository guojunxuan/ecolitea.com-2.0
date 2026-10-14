// @vitest-environment node
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RichText from '@/components/RichText'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type Payload, type Field } from 'payload'
import { defaultLexical } from '@/fields/defaultLexical'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => null }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const flatten = (fields: Field[]): Field[] =>
  fields.flatMap((field) => [
    field,
    ...('fields' in field ? flatten(field.fields) : []),
    ...('tabs' in field ? field.tabs.flatMap((tab) => flatten(tab.fields)) : []),
  ])

describe('Blog collection configuration', () => {
  it('evaluates the anonymous publication cutoff for each request', async () => {
    const { Blogs } = await import('@/collections/Blogs')
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      for (const now of ['2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z']) {
        vi.setSystemTime(new Date(now))
        expect(await Blogs.access!.read!({ req: { user: null } } as never)).toEqual({
          _status: { equals: 'published' },
          publishedAt: { exists: true, less_than_equal: now },
        })
      }
      expect(await Blogs.access!.read!({ req: { user: { id: 'author' } } } as never)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('registers ordered categories, the category join, listing projections, and version settings', async () => {
    const config = await (await import('@/payload.config')).default
    const blogs = config.collections.find(({ slug }) => slug === 'blogs')
    const categories = config.collections.find(({ slug }) => slug === 'blog-categories')
    expect(blogs).toBeDefined()
    expect(categories).toMatchObject({ orderable: true, admin: { group: 'Blog' } })
    expect(categories?.fields).toContainEqual(
      expect.objectContaining({ name: 'blogs', type: 'join', collection: 'blogs', on: 'category' }),
    )
    expect(blogs?.defaultPopulate).toEqual({
      title: true,
      slug: true,
      category: true,
      heroImage: true,
      excerpt: true,
      publishedAt: true,
    })
    expect(blogs?.versions).toMatchObject({
      drafts: { autosave: { interval: 100 }, schedulePublish: true },
      maxPerDoc: 50,
    })
    const fields = flatten(blogs!.fields)
    const content = fields.find((field) => 'name' in field && field.name === 'content')
    expect(content).toMatchObject({ type: 'richText', required: true })
    expect(content).not.toHaveProperty('blocks')
    const projectedAuthors = fields.find(
      (field) => 'name' in field && field.name === 'populatedAuthors',
    )!
    if (!('access' in projectedAuthors)) throw new Error('Missing populatedAuthors access config')
    expect(projectedAuthors.admin).toMatchObject({ disabled: true, readOnly: true })
    expect(projectedAuthors.access?.create?.({} as never)).toBe(false)
    expect(projectedAuthors.access?.update?.({} as never)).toBe(false)
    expect(fields.find((field) => 'name' in field && field.name === 'relatedBlogs')).toMatchObject({
      maxRows: 3,
      hasMany: true,
    })
  }, 20_000)
})

describe('Blogs through the isolated Payload Local API', () => {
  let payload: Payload
  let categoryID: string
  let mediaID: string
  let user: Awaited<ReturnType<Payload['create']>>
  const context = { disableRevalidate: true }
  const createBlog = (data: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'blogs',
      context,
      user: user as never,
      data: {
        title: 'Test blog',
        slug: `blog-${randomUUID()}`,
        category: categoryID,
        heroImage: mediaID,
        excerpt: 'Test excerpt',
        content: {
          root: {
            type: 'root',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            children: [
              {
                type: 'paragraph',
                version: 1,
                direction: null,
                format: '',
                indent: 0,
                textFormat: 0,
                textStyle: '',
                children: [
                  {
                    type: 'text',
                    version: 1,
                    text: 'Test content',
                    format: 0,
                    detail: 0,
                    mode: 'normal',
                    style: '',
                  },
                ],
              },
            ],
          },
        },
        _status: 'published',
        ...data,
      } as never,
    })

  beforeAll(async () => {
    const root = await (await import('@/payload.config')).default
    expect(root.collections.some(({ slug }) => slug === 'blogs')).toBe(true)
    const { Blogs } = await import('@/collections/Blogs')
    const { BlogCategories } = await import('@/collections/BlogCategories')
    const { Users } = await import('@/collections/Users')
    const databaseName = `ecolitea2-blogs-schema-${randomUUID()}`
    const url = `mongodb://127.0.0.1:27017/${databaseName}`
    console.info(
      `Blogs schema target: ${url}; DISABLE_R2_STORAGE=${process.env.DISABLE_R2_STORAGE}; no storage plugins, local uploads disabled`,
    )
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const { plugins } = await import('@/plugins')
    const search = plugins.find((plugin) => plugin.slug === '@payloadcms/plugin-search')!
    const config = await buildConfig({
      plugins: [search],
      typescript: { autoGenerate: false },
      editor: defaultLexical,
      collections: [
        {
          ...Blogs,
          fields: Blogs.fields.map((field) =>
            field.type === 'date' && field.name === 'publishedAt'
              ? {
                  ...field,
                  hooks: {
                    ...field.hooks,
                    beforeChange: [
                      ...(field.hooks?.beforeChange || []),
                      // Model a legacy undated published row through Payload, without direct DB writes.
                      ({ value, context }) => (context.testUndatedBlog ? null : value),
                    ],
                  },
                }
              : field,
          ),
        },
        BlogCategories,
        Users,
        ...(['pages', 'posts', 'case-studies', 'categories', 'forms'] as const).map((slug) => ({
          slug,
          fields: [{ name: 'title', type: 'text' as const }],
        })),
        {
          slug: 'media',
          upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
          fields: [{ name: 'alt', type: 'text' }],
        },
      ],
      db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3_000 } }),
      secret: 'isolated-blogs-schema-test-secret-32-characters',
    })
    // Payload skips already-sanitized root blocks when buildConfig runs again.
    // Reuse the resolved registry after building the isolated collection config.
    config.blocks = root.blocks
    payload = await getPayload({ config, key: databaseName })
    categoryID = (
      await payload.create({
        collection: 'blog-categories',
        context,
        data: { title: 'Tea', slug: 'tea' },
      })
    ).id
    mediaID = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Test hero', mimeType: 'image/png' },
      })
    ).id
    user = await payload.create({
      collection: 'users',
      data: {
        email: 'blog-author@example.test',
        password: 'isolated-test-password',
        name: 'Test Author',
      },
    })
  }, 25_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })

  it('creates, updates, joins, and deletes categories', async () => {
    const category = await payload.create({
      collection: 'blog-categories',
      context,
      data: { title: 'Disposable', slug: 'disposable' },
    })
    expect(category._order).toBeTruthy()
    await expect(
      payload.update({
        collection: 'blog-categories',
        context,
        id: category.id,
        data: { title: 'Renamed' },
      }),
    ).resolves.toMatchObject({ title: 'Renamed' })
    const blog = await createBlog()
    const joined = await payload.findByID({
      collection: 'blog-categories',
      id: categoryID,
      depth: 0,
    })
    expect(joined.blogs?.docs).toContain(blog.id)
    await payload.delete({ collection: 'blog-categories', context, id: category.id })
    await expect(
      payload.findByID({ collection: 'blog-categories', id: category.id }),
    ).rejects.toThrow()
  })

  it.each(['heroImage', 'excerpt', 'category', 'content'])(
    'rejects missing %s on publication',
    async (field) => {
      await expect(createBlog({ [field]: null })).rejects.toMatchObject({
        data: { errors: expect.arrayContaining([expect.objectContaining({ path: field })]) },
      })
    },
  )

  it('rejects empty content, long excerpts, and reserved slugs', async () => {
    for (const [field, value] of [
      [
        'content',
        {
          root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [] },
        },
      ],
      ['excerpt', 'a'.repeat(161)],
      ['slug', 'category'],
      ['slug', 'page'],
    ] as const) {
      await expect(createBlog({ [field]: value })).rejects.toMatchObject({
        data: { errors: expect.arrayContaining([expect.objectContaining({ path: field })]) },
      })
    }
  })

  it('defaults the author, projects public author fields, and dates first publication only', async () => {
    const draft = await createBlog({ _status: 'draft' })
    expect(draft.publishedAt).toBeFalsy()
    expect(draft.content.root.children[0]).toMatchObject({
      type: 'paragraph',
      children: [expect.objectContaining({ text: 'Test content' })],
    })
    await expect(
      payload.findByID({ collection: 'blogs', id: draft.id, overrideAccess: false }),
    ).rejects.toThrow()
    const storedDraft = await payload.findByID({
      collection: 'blogs',
      id: draft.id,
      depth: 0,
      draft: true,
    })
    expect(storedDraft.content).toEqual(draft.content)
    expect(
      draft.authors?.map((author) => (typeof author === 'object' ? author.id : author)),
    ).toEqual([user.id])
    const published = await payload.update({
      collection: 'blogs',
      id: draft.id,
      context,
      data: { _status: 'published' },
    })
    expect(published.category).toMatchObject({ id: categoryID })
    expect(published.content).toEqual(draft.content)
    expect(published.publishedAt).toBeTruthy()
    expect(published.populatedAuthors).toEqual([{ id: user.id, name: 'Test Author' }])
    const updated = await payload.update({
      collection: 'blogs',
      id: draft.id,
      context,
      data: { excerpt: 'Updated' },
    })
    expect(updated.publishedAt).toBe(published.publishedAt)
    const publicDoc = await payload.findByID({
      collection: 'blogs',
      id: draft.id,
      overrideAccess: false,
    })
    expect(publicDoc.populatedAuthors).toEqual([{ id: user.id, name: 'Test Author' }])
    expect(JSON.stringify(publicDoc)).not.toContain('blog-author@example.test')
  })

  it('enforces anonymous publication dates through Payload find and findByID access', async () => {
    const published = await createBlog({ publishedAt: '2020-01-01T00:00:00.000Z' })
    const future = await createBlog({ publishedAt: '2099-01-01T00:00:00.000Z' })
    const draft = await createBlog({ _status: 'draft' })
    const undated = await payload.update({
      collection: 'blogs',
      id: published.id,
      context: { ...context, testUndatedBlog: true },
      data: { publishedAt: null },
    })
    expect(undated.publishedAt).toBeNull()
    const visible = await createBlog({ publishedAt: '2020-01-01T00:00:00.000Z' })
    const ids = [future.id, draft.id, undated.id, visible.id]
    const anonymous = await payload.find({
      collection: 'blogs',
      overrideAccess: false,
      where: { id: { in: ids } },
      depth: 0,
    })
    expect(anonymous.docs.map(({ id }) => id)).toEqual([visible.id])
    for (const id of [future.id, draft.id, undated.id]) {
      await expect(
        payload.findByID({ collection: 'blogs', id, overrideAccess: false }),
      ).rejects.toThrow()
    }
    const authenticated = await payload.find({
      collection: 'blogs',
      overrideAccess: false,
      user: user as never,
      where: { id: { in: ids } },
      depth: 0,
    })
    expect(authenticated.docs.map(({ id }) => id).sort()).toEqual(ids.sort())
    await expect(
      payload.findByID({
        collection: 'blogs',
        id: future.id,
        overrideAccess: false,
        user: user as never,
      }),
    ).resolves.toMatchObject({ id: future.id })
  })

  it('refreshes search category presentation after a real category rename and deletion', async () => {
    const { resolveBlogSearchResults } = await import('@/search/resolveBlogSearchResults')
    const category = await payload.create({
      collection: 'blog-categories',
      context,
      data: { title: 'Old category', slug: 'old-category' },
    })
    const blog = await createBlog({ category: category.id })
    const indexed = await payload.find({
      collection: 'search',
      overrideAccess: false,
      where: { 'doc.value': { equals: blog.id } },
    })
    expect(indexed.docs).toHaveLength(1)
    expect(indexed.docs[0].category).toMatchObject({
      categoryID: category.id,
      slug: 'old-category',
    })
    await payload.update({
      collection: 'blog-categories',
      id: category.id,
      context,
      data: { title: 'New category', slug: 'new-category' },
    })
    expect((await resolveBlogSearchResults(payload, indexed.docs))[0].category).toMatchObject({
      title: 'New category',
      slug: 'new-category',
    })
    await payload.delete({ collection: 'blog-categories', id: category.id, context })
    expect((await resolveBlogSearchResults(payload, indexed.docs))[0].category).toBe('')
  })

  it.each(['draft', 'future', 'deleted'])(
    'renders an anonymous parent with a %s internal Blog link',
    async (status) => {
      const target = await createBlog({
        _status: status === 'draft' ? 'draft' : 'published',
        publishedAt: status === 'future' ? '2999-01-01T00:00:00.000Z' : '2020-01-01T00:00:00.000Z',
      })
      const parent = await createBlog({
        content: {
          root: {
            type: 'root',
            version: 1,
            direction: null,
            format: '',
            indent: 0,
            children: [
              {
                type: 'paragraph',
                version: 1,
                direction: null,
                format: '',
                indent: 0,
                children: [
                  {
                    type: 'link',
                    version: 3,
                    direction: null,
                    format: '',
                    indent: 0,
                    fields: {
                      linkType: 'internal',
                      doc: { relationTo: 'blogs', value: target.id },
                    },
                    children: [
                      {
                        type: 'text',
                        version: 1,
                        text: 'Related story',
                        format: 0,
                        detail: 0,
                        mode: 'normal',
                        style: '',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      })
      if (status === 'deleted')
        await payload.delete({ collection: 'blogs', id: target.id, context })
      const anonymous = await payload.findByID({
        collection: 'blogs',
        id: parent.id,
        depth: 2,
        overrideAccess: false,
      })
      const paragraph = anonymous.content.root.children[0] as {
        children: { fields: { doc: { value: unknown } } }[]
      }
      expect(paragraph.children[0].fields.doc.value).toBe(target.id)
      expect(
        renderToStaticMarkup(React.createElement(RichText, { data: anonymous.content })),
      ).toContain('href="#"')
    },
  )

  it('limits related blogs to three and rejects self selection', async () => {
    const related = await Promise.all(Array.from({ length: 4 }, () => createBlog()))
    await expect(createBlog({ relatedBlogs: related.map(({ id }) => id) })).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'relatedBlogs' })]) },
    })
    await expect(
      payload.update({
        collection: 'blogs',
        context,
        id: related[0].id,
        data: { relatedBlogs: [related[0].id] },
      }),
    ).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'relatedBlogs' })]) },
    })
    await expect(
      createBlog({ relatedBlogs: related.slice(0, 3).map(({ id }) => id) }),
    ).resolves.toBeDefined()
  })
})
