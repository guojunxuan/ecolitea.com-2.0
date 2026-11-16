import { publicSourceVisibility, isPublicSource } from '@/utilities/i18n/publicSourceVisibility'
// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { translations } from '@/plugins/translation/collections/translations'
import { translationSearch } from '@/plugins/translation/collections/translationSearch'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

vi.mock('@/i18n/config', async (original) => {
  const config = await original<typeof import('@/i18n/config')>()
  const de = { code: 'de', label: 'Deutsch', status: 'live' as const }
  const fr = { code: 'fr', label: 'Français', status: 'translating' as const }
  return { ...config, publicLocales: [...config.publicLocales, de], targetLocales: [de, fr] }
})

describe('translated search and redirect destinations (isolated MongoDB)', () => {
  const name = `ecolitea2-test-phase3-search-${randomUUID().slice(0, 8)}`
  const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test-phase3')
  let payload: Payload
  const config = buildConfig({
    secret: 'phase3-search-only-test-secret-at-least-32-characters',
    typescript: { autoGenerate: false },
    db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    collections: [
      ...(['pages', 'blogs', 'posts', 'products'] as const).map((slug) => ({
        slug,
        access: { read: authenticatedOrPublished },
        fields: [
          { name: 'title', type: 'text' as const },
          { name: 'slug', type: 'text' as const },
          { name: 'publishedAt', type: 'date' as const },
          { name: 'categorySlug', type: 'text' as const },
          ...(slug === 'products'
            ? [
                {
                  name: 'category',
                  type: 'relationship' as const,
                  relationTo: 'product-categories' as const,
                },
              ]
            : []),
        ],
        versions: { drafts: true },
      })),
      {
        slug: 'product-categories',
        access: { read: () => true },
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
        ],
      },
      {
        slug: 'blog-categories',
        access: { read: () => true },
        fields: [
          { name: 'title', type: 'text' },
          { name: 'slug', type: 'text' },
        ],
      },
      translations,
      translationSearch,
    ],
    globals: [
      {
        slug: 'site-settings',
        access: { read: () => true },
        fields: [{ name: 'privacyPolicyPage', type: 'relationship', relationTo: 'pages' }],
      },
    ],
  })
  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase3 search target=${url}; storage=disabled; provider=none`)
    payload = await getPayload({ config, key: name })
  }, 20000)
  afterAll(async () => {
    if (!payload) return
    console.info(`Phase3 search cleanup target=${url}; storage=disabled`)
    try {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
    } finally {
      await payload.destroy()
    }
  })
  beforeEach(async () => {
    await payload.updateGlobal({ slug: 'site-settings', data: { privacyPolicyPage: null } })
    for (const collection of [
      'translation-search',
      'translations',
      'pages',
      'blogs',
      'posts',
      'products',
      'product-categories',
      'blog-categories',
    ] as const)
      await payload.delete({ collection, where: {} })
  })
  const source = (
    collection: 'blogs' | 'posts' | 'pages' | 'products',
    title: string,
    options: Record<string, unknown> = {},
  ) =>
    payload.create({
      collection,
      data: {
        title,
        slug: title.toLowerCase(),
        _status: 'published',
        publishedAt: '2020-01-01T00:00:00Z',
        ...options,
      } as never,
    })
  const checkpoint = (
    collection: string,
    id: string,
    fields = { title: 'Tee übersetzt' },
    status: 'ready' | 'pending' = 'ready',
  ) =>
    payload.create({
      collection: 'translations',
      data: {
        sourceCollection: collection,
        sourceId: id,
        locale: 'de',
        status,
        lastReadySourceVersion: '2020-01-01T00:00:00Z',
        fields,
      },
    })
  const index = (collection: string, id: string, locale = 'de', ready = true) =>
    payload.create({
      collection: 'translation-search',
      data: {
        sourceCollection: collection,
        sourceId: id,
        locale,
        ready,
        sourceVersion: 'old-version',
        title: 'Tee',
        path: '/old-slug',
      },
    })

  it('returns only current public German article checkpoints, retaining a ready result while an update is pending', async () => {
    const { getTranslatedSearchResults } = await import('@/search/getTranslatedSearchResults')
    const blog = await source('blogs', 'Ready')
    const post = await source('posts', 'News')
    const future = await source('blogs', 'Future', { publishedAt: '2099-01-01T00:00:00Z' })
    const draft = await source('blogs', 'Private', { _status: 'draft' })
    const incomplete = await source('blogs', 'Incomplete')
    for (const doc of [blog, future, draft]) {
      await index('blogs', doc.id)
      await checkpoint('blogs', doc.id)
    }
    await index('blogs', incomplete.id)
    await index('posts', post.id)
    await checkpoint('posts', post.id, { title: 'Tee Nachrichten' }, 'pending')
    await index('pages', (await source('pages', 'Unrenderable')).id)
    const french = await source('blogs', 'French')
    await index('blogs', french.id, 'fr')
    await checkpoint('blogs', french.id)
    const notReady = await source('blogs', 'NotReady')
    await index('blogs', notReady.id, 'de', false)
    await checkpoint('blogs', notReady.id)
    const result = await getTranslatedSearchResults(payload, 'Tee', 'de')
    expect(result.blogs.map((doc) => [doc.title, doc.slug])).toEqual([['Tee übersetzt', 'ready']])
    expect(result.posts.map((doc) => [doc.title, doc.slug])).toEqual([['Tee Nachrichten', 'news']])
    expect(await getTranslatedSearchResults(payload, '', 'fr')).toEqual({ blogs: [], posts: [] })
  })

  it('filters stale/hidden source hits before applying the twelve-card display limit', async () => {
    const { getTranslatedSearchResults } = await import('@/search/getTranslatedSearchResults')
    for (let i = 0; i < 13; i++) await index('blogs', randomUUID().replaceAll('-', '').slice(0, 24))
    const blog = await source('blogs', 'AfterHidden')
    await index('blogs', blog.id)
    await checkpoint('blogs', blog.id)
    expect(
      (await getTranslatedSearchResults(payload, '', 'de')).blogs.map((doc) => doc.slug),
    ).toEqual(['afterhidden'])
  })

  it('fills twelve renderable cards even when the source query would otherwise use its default limit', async () => {
    const { getTranslatedSearchResults } = await import('@/search/getTranslatedSearchResults')
    for (let i = 0; i < 13; i++) {
      const blog = await source('blogs', `Visible${i}`)
      await index('blogs', blog.id)
      await checkpoint('blogs', blog.id)
    }
    expect((await getTranslatedSearchResults(payload, '', 'de')).blogs).toHaveLength(12)
  })

  it('resolves reference IDs in the requested locale and temporarily falls back to current English URL when unavailable', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    const blog = await source('blogs', 'Current')
    const item = {
      to: { reference: { relationTo: 'blogs' as const, value: { id: blog.id, slug: 'old' } } },
    }
    expect(await resolveLocalizedRedirect(payload, item as never, 'de')).toEqual({
      path: '/blogs/current',
      permanent: false,
    })
    await checkpoint('blogs', blog.id)
    expect(await resolveLocalizedRedirect(payload, item as never, 'de')).toEqual({
      path: '/de/blogs/current',
      permanent: true,
    })
    expect(await resolveLocalizedRedirect(payload, item as never, 'en')).toEqual({
      path: '/blogs/current',
      permanent: true,
    })
    await payload.update({ collection: 'blogs', id: blog.id, data: { _status: 'draft' } })
    expect(await resolveLocalizedRedirect(payload, item as never, 'de')).toBeNull()
  })

  it('resolves current Product/category paths only when their English source is publicly visible', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    const category = await payload.create({
      collection: 'product-categories',
      data: { title: 'Tea', slug: 'tea' } as never,
    })
    const product = await source('products', 'Oolong', {
      category: category.id,
      categorySlug: 'tea',
    })
    const productItem = { to: { reference: { relationTo: 'products', value: product.id } } }
    const categoryItem = {
      to: { reference: { relationTo: 'product-categories', value: category.id } },
    }
    expect(await resolveLocalizedRedirect(payload, productItem as never, 'de')).toEqual({
      path: '/products/tea/oolong',
      permanent: false,
    })
    await checkpoint('products', product.id)
    expect(await resolveLocalizedRedirect(payload, productItem as never, 'de')).toEqual({
      path: '/de/products/tea/oolong',
      permanent: true,
    })
    expect(await resolveLocalizedRedirect(payload, categoryItem as never, 'de')).toEqual({
      path: '/products/tea',
      permanent: false,
    })
    await checkpoint('product-categories', category.id)
    expect(await resolveLocalizedRedirect(payload, categoryItem as never, 'de')).toEqual({
      path: '/de/products/tea',
      permanent: true,
    })
    await payload.update({
      collection: 'products',
      id: product.id,
      data: { publishedAt: '2099-01-01T00:00:00Z' },
    })
    expect(await resolveLocalizedRedirect(payload, productItem as never, 'de')).toBeNull()
    expect(await resolveLocalizedRedirect(payload, categoryItem as never, 'de')).toBeNull()
  })

  it('checks explicit category URL readiness while preserving pagination and query strings', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    const category = await payload.create({
      collection: 'blog-categories',
      data: { title: 'Tea', slug: 'tea' } as never,
    })
    const item = { to: { url: '/blogs/category/tea/page/2?q=tea' } }
    expect(await resolveLocalizedRedirect(payload, item, 'de')).toEqual({
      path: '/blogs/category/tea/page/2?q=tea',
      permanent: false,
    })
    await checkpoint('blog-categories', category.id)
    expect(await resolveLocalizedRedirect(payload, item, 'de')).toEqual({
      path: '/de/blogs/category/tea/page/2?q=tea',
      permanent: false,
    })
  })

  it('uses the localized homepage URL for explicit root destinations', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    const home = await source('pages', 'Home')
    expect(await resolveLocalizedRedirect(payload, { to: { url: '/' } }, 'de')).toEqual({
      path: '/',
      permanent: false,
    })
    await checkpoint('pages', home.id)
    expect(await resolveLocalizedRedirect(payload, { to: { url: '/' } }, 'de')).toEqual({
      path: '/de',
      permanent: false,
    })
  })

  it('keeps legal and unavailable explicit document URLs English and leaves external URLs unchanged', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    const legal = await source('pages', 'Privacy')
    await payload.updateGlobal({ slug: 'site-settings', data: { privacyPolicyPage: legal.id } })
    expect(
      await resolveLocalizedRedirect(
        payload,
        { to: { reference: { relationTo: 'pages', value: legal.id } } } as never,
        'de',
      ),
    ).toEqual({ path: '/privacy', permanent: true })
    const blog = await source('blogs', 'Article')
    expect(
      await resolveLocalizedRedirect(
        payload,
        { to: { url: '/blogs/article?q=tea#more' } } as never,
        'de',
      ),
    ).toEqual({ path: '/blogs/article?q=tea#more', permanent: false })
    await checkpoint('blogs', blog.id)
    expect(
      await resolveLocalizedRedirect(
        payload,
        { to: { url: '/blogs/article?q=tea#more' } } as never,
        'de',
      ),
    ).toEqual({ path: '/de/blogs/article?q=tea#more', permanent: false })
    for (const path of ['https://external.example/de?a=b', '//external.example/path', '/admin'])
      expect(await resolveLocalizedRedirect(payload, { to: { url: path } } as never, 'de')).toEqual(
        { path, permanent: false },
      )
  })
})


describe('source visibility parity', () => {
  it('retains status-only Posts and Case Studies while honoring Blog/Product timestamps', () => {
    const future = { _status: 'published', publishedAt: '2099-01-01T00:00:00Z' }
    for (const collection of ['posts', 'case-studies']) {
      expect(publicSourceVisibility(collection)).toEqual({ _status: { equals: 'published' } })
      expect(isPublicSource(future, collection)).toBe(true)
    }
    for (const collection of ['blogs', 'products']) expect(isPublicSource(future, collection)).toBe(false)
  })
})


describe('locale-neutral redirect destinations', () => {
  it('keeps root-level static resources and their suffix without a document lookup', async () => {
    const { resolveLocalizedRedirect } = await import('@/utilities/i18n/resolveRedirect')
    expect(await resolveLocalizedRedirect({} as never, { to: { url: '/catalog.pdf?download=1#intro' } }, 'de')).toEqual({ path: '/catalog.pdf?download=1#intro', permanent: false })
  })
})
