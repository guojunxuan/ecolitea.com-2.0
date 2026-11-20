import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Where } from 'payload'

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  ready: new Set<string>(),
}))

// Exercise the real public readers against an in-memory Payload boundary. No database is used.
function matches(doc: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'and') return (condition as Where[]).every((item) => matches(doc, item))
    if (key === 'or') return (condition as Where[]).some((item) => matches(doc, item))
    const value = key
      .split('.')
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === 'object'
            ? (current as Record<string, unknown>)[part]
            : undefined,
        doc,
      )
    return Object.entries(condition as Record<string, unknown>).every(([operator, expected]) => {
      if (operator === 'equals') return value === expected
      if (operator === 'in') return (expected as unknown[]).includes(value)
      if (operator === 'exists') return (value !== undefined && value !== null) === expected
      if (operator === 'less_than_equal') return String(value) <= String(expected)
      if (operator === 'like')
        return String(value ?? '')
          .toLowerCase()
          .includes(String(expected).toLowerCase())
      throw new Error(`Unsupported fixture operator: ${operator}`)
    })
  })
}

vi.mock('payload', async (original) => ({
  ...(await original<object>()),
  getPayload: async () => ({
    config: { collections: [], globals: [] },
    find: async ({
      collection,
      where,
      page = 1,
      limit = 10,
      pagination = true,
    }: {
      collection: string
      where?: Where
      page?: number
      limit?: number
      pagination?: boolean
    }) => {
      const all = (fixture.rows[collection] ?? []).filter((doc) => matches(doc, where))
      return {
        docs: pagination ? all.slice((page - 1) * limit, page * limit) : all,
        totalDocs: all.length,
        totalPages: Math.ceil(all.length / limit),
        page,
        limit,
        hasNextPage: page * limit < all.length,
      }
    },
  }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ unstable_cache: (read: () => unknown) => read }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSiteSettings: async () => ({}) }))
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({ publicLocales: [{ code: 'en' }, { code: 'de' }] }),
}))
vi.mock('@/plugins/translation/read', () => ({
  mergeTranslation: async (
    doc: Record<string, unknown>,
    { sourceCollection }: { sourceCollection: string },
  ) => (fixture.ready.has(`${sourceCollection}:${doc.id}`) ? doc : null),
}))
vi.mock('@/utilities/blogs/getBlogListingHero', () => ({ getBlogListingHero: async () => null }))
vi.mock('@/utilities/products/getProductListingHero', () => ({
  getProductListingHero: async () => [],
}))
vi.mock('@/utilities/products/getProductListingSEO', () => ({
  getProductListingSEO: async () => ({ title: 'Products' }),
}))
vi.mock('@/utilities/products/getProductCategoryCarousel', () => ({
  getProductCategoryCarousel: async () => [],
}))
vi.mock('@/components/CollectionArchive', () => ({ CollectionArchive: () => null }))
vi.mock('@/components/PayloadRedirects', () => ({ PayloadRedirects: () => null }))
vi.mock('@/components/Media', () => ({ Media: () => null }))
vi.mock('@/components/Products/CategoryBand', () => ({ CategoryBand: () => null }))
vi.mock('@/components/Products/CategoryCard', () => ({ CategoryCard: () => null }))
vi.mock('@/components/Products/ProductCard', () => ({ ProductCard: () => null }))
vi.mock('@/components/Products/OverflowCarousel', () => ({ OverflowCarousel: () => null }))
vi.mock('@/components/Products/AnchorNav', () => ({ AnchorNav: () => null }))
vi.mock('@/components/Products/CategoryCarousel', () => ({ CategoryCarousel: () => null }))
vi.mock('@/components/Products/ProductPreviewGrid', () => ({ ProductPreviewGrid: () => null }))
vi.mock('@/heros/ProductListingHero', () => ({ ProductListingHero: () => null }))
vi.mock('@/heros/BlogListingHero', () => ({ BlogListingHero: () => null }))
vi.mock('@/heros/HeaderThemeSync', () => ({ HeaderThemeSync: () => null }))

import { blogListingMetadata, renderBlogListing } from '@/app/(frontend)/[lang]/blogs/listing'
import Products from '@/app/(frontend)/[lang]/products/page'
import { renderProductListing } from '@/app/(frontend)/[lang]/products/[category]/listing'
import Search from '@/app/(frontend)/[lang]/search/page'

const published = { _status: 'published', publishedAt: '2026-01-01T00:00:00.000Z' }
function setReady(collection: string, id: string) {
  fixture.ready.add(`${collection}:${id}`)
  fixture.rows.translations.push({
    sourceCollection: collection,
    sourceId: id,
    locale: 'de',
    lastReadySourceVersion: 'v1',
    fields: {},
  })
}

beforeEach(() => {
  fixture.ready.clear()
  fixture.rows = {
    'blog-categories': [{ id: 'tea', slug: 'tea', title: 'Tea', meta: {} }],
    blogs: [{ id: 'blog', title: 'Tea article', slug: 'tea', category: 'tea', ...published }],
    'product-categories': [{ id: 'tea', slug: 'tea', title: 'Tea', meta: {} }],
    products: [
      {
        id: 'product',
        title: 'Tea bag',
        slug: 'tea-bag',
        category: 'tea',
        categorySlug: 'tea',
        ...published,
      },
    ],
    translations: [],
    'translation-search': [],
    search: [
      {
        id: 'search-blog',
        title: 'Tea article',
        slug: 'tea',
        doc: { relationTo: 'blogs', value: 'blog' },
        ...published,
      },
    ],
  }
  // Category translations alone do not make their article/product lists ready.
  setReady('blog-categories', 'tea')
  setReady('product-categories', 'tea')
})

const routes = [
  { path: '/blogs', read: (lang: string) => renderBlogListing({ locale: lang, page: 1 }) },
  {
    path: '/blogs/page/2',
    read: (lang: string) => renderBlogListing({ locale: lang, page: 2 }),
    paginated: true,
  },
  {
    path: '/blogs/category/tea',
    read: (lang: string) => renderBlogListing({ locale: lang, page: 1, categorySlug: 'tea' }),
  },
  {
    path: '/blogs/category/tea/page/2',
    read: (lang: string) => renderBlogListing({ locale: lang, page: 2, categorySlug: 'tea' }),
    paginated: true,
  },
  { path: '/products', read: (lang: string) => Products({ params: Promise.resolve({ lang }) }) },
  {
    path: '/products/tea',
    read: (lang: string) => renderProductListing({ locale: lang, page: 1, categorySlug: 'tea' }),
  },
  {
    path: '/products/tea/page/2',
    read: (lang: string) => renderProductListing({ locale: lang, page: 2, categorySlug: 'tea' }),
    paginated: true,
  },
  {
    path: '/search?q=green%20%26%20black',
    read: (lang: string) =>
      Search({
        params: Promise.resolve({ lang }),
        searchParams: Promise.resolve({ q: 'green & black' }),
      }),
  },
]

function fillPages() {
  for (const collection of ['blogs', 'products']) {
    const source = fixture.rows[collection][0]
    fixture.rows[collection] = Array.from({ length: 13 }, (_, index) => ({
      ...source,
      id: `${collection}-${index}`,
    }))
  }
}
function translateArticlesAndProducts() {
  for (const collection of ['blogs', 'products']) {
    for (const doc of fixture.rows[collection]) {
      setReady(collection, String(doc.id))
      if (collection === 'blogs')
        fixture.rows['translation-search'].push({
          id: `index-${doc.id}`,
          locale: 'de',
          ready: true,
          sourceCollection: collection,
          sourceId: doc.id,
          title: 'green & black',
        })
    }
  }
}

// These catch missing guards on first pages and path loss on category/pagination fallbacks.
describe('public listing locale fallback', () => {
  it.each(routes)('keeps English $path rendering normally', async ({ read, paginated }) => {
    if (paginated) fillPages()
    await expect(read('en')).resolves.toBeTruthy()
  })

  it.each(routes)(
    'temporarily redirects empty German $path to the matching English URL',
    async ({ path, read, paginated }) => {
      if (paginated) fillPages()
      await expect(read('de')).rejects.toMatchObject({
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      })
    },
  )

  it.each(routes)(
    'keeps German $path when public ready content exists',
    async ({ read, paginated }) => {
      if (paginated) fillPages()
      translateArticlesAndProducts()
      await expect(read('de')).resolves.toBeTruthy()
    },
  )

  it('keeps an unmatched German search when German articles exist', async () => {
    translateArticlesAndProducts()
    await expect(
      Search({
        params: Promise.resolve({ lang: 'de' }),
        searchParams: Promise.resolve({ q: 'unmatched' }),
      }),
    ).resolves.toBeTruthy()
  })

  it('does not treat ready products as searchable German articles', async () => {
    setReady('products', 'product')
    await expect(
      Search({ params: Promise.resolve({ lang: 'de' }), searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({ digest: 'NEXT_REDIRECT;replace;/search;307;' })
  })

  it('keeps German search when a ready blog is missing from the index', async () => {
    setReady('blogs', 'blog')
    await expect(
      Search({
        params: Promise.resolve({ lang: 'de' }),
        searchParams: Promise.resolve({ q: 'unmatched' }),
      }),
    ).resolves.toBeTruthy()
  })

  it('preserves the requested page in a blog category fallback when another category has German content', async () => {
    fixture.rows.blogs.push({
      id: 'other',
      title: 'Other article',
      slug: 'other',
      category: 'other',
      ...published,
    })
    setReady('blogs', 'other')
    await expect(
      renderBlogListing({ locale: 'de', page: 2, categorySlug: 'tea' }),
    ).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/blogs/category/tea/page/2;307;',
    })
  })

  it('preserves the full category pagination path when metadata redirects before rendering', async () => {
    await expect(
      blogListingMetadata({ locale: 'de', page: 2, categorySlug: 'tea' }),
    ).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/blogs/category/tea/page/2;307;',
    })
  })

  it('uses the same temporary redirect for category page rendering and metadata', async () => {
    const args = { locale: 'de', page: 2, categorySlug: 'tea' }
    for (const read of [blogListingMetadata, renderBlogListing]) {
      await expect(read(args)).rejects.toMatchObject({
        digest: 'NEXT_REDIRECT;replace;/blogs/category/tea/page/2;307;',
      })
    }
  })

  it('redirects both category metadata and rendering when English articles are also empty', async () => {
    fixture.rows.blogs = []
    const args = { locale: 'de', page: 2, categorySlug: 'tea' }
    for (const read of [blogListingMetadata, renderBlogListing]) {
      await expect(read(args)).rejects.toMatchObject({
        digest: 'NEXT_REDIRECT;replace;/blogs/category/tea/page/2;307;',
      })
    }
  })

  it.each([
    {
      name: 'blogs',
      read: () => renderBlogListing({ locale: 'de', page: 2 }),
      path: '/blogs/page/2',
    },
    {
      name: 'products',
      read: () => renderProductListing({ locale: 'de', page: 2, categorySlug: 'tea' }),
      path: '/products/tea/page/2',
    },
  ])(
    'preserves the existing $name pagination fallback when German has only one ready item',
    async ({ name, read, path }) => {
      fillPages()
      setReady(name, `${name}-0`)
      await expect(read()).rejects.toMatchObject({ digest: `NEXT_REDIRECT;replace;${path};307;` })
    },
  )

  it('keeps an empty product category when another category has a German product', async () => {
    fixture.rows.products.push({
      id: 'other',
      title: 'Other product',
      slug: 'other',
      category: 'other',
      ...published,
    })
    setReady('products', 'other')
    await expect(
      renderProductListing({ locale: 'de', page: 1, categorySlug: 'tea' }),
    ).resolves.toBeTruthy()
  })

  it.each(routes)(
    'redirects empty German $path even when English has no public content',
    async ({ read, path }) => {
      fixture.rows.blogs = []
      fixture.rows.products = []
      await expect(read('de')).rejects.toMatchObject({
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      })
    },
  )

  it('does not let draft or future sources prevent the empty-language fallback', async () => {
    fixture.rows.blogs[0]._status = 'draft'
    fixture.rows.blogs.push({
      ...fixture.rows.blogs[0],
      id: 'future',
      _status: 'published',
      publishedAt: '2999-01-01T00:00:00.000Z',
    })
    setReady('blogs', 'blog')
    setReady('blogs', 'future')
    fixture.rows.blogs.push({
      id: 'english',
      title: 'English',
      slug: 'english',
      category: 'tea',
      ...published,
    })
    await expect(renderBlogListing({ locale: 'de', page: 1 })).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/blogs;307;',
    })
  })
})
