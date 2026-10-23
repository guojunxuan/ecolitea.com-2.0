import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  auth: vi.fn(),
  cache: vi.fn(),
  settings: vi.fn(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => mocks }))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keys: unknown, options: unknown) => {
    mocks.cache(keys, options)
    return fn
  },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/utilities/getGlobals', () => ({ getCachedSettings: mocks.settings }))
import { getProductListing } from '@/utilities/products/getProductListing'
import { getProductBySlug } from '@/utilities/products/getProductBySlug'
import { getRelatedProducts } from '@/utilities/products/getRelatedProducts'
import { getProductCategoriesOverview } from '@/utilities/products/getProductCategoriesOverview'
import { getProductCategoryBySlug } from '@/utilities/products/getProductCategoryBySlug'
import { getProductStaticParams } from '@/utilities/products/getProductStaticParams'
import { getProductListingSEO } from '@/utilities/products/getProductListingSEO'
const category = { id: 'cat', title: 'Tea', slug: 'tea', image: 'raw' }
const product = (id: string) => ({
  id,
  title: id,
  slug: id,
  category,
  categorySlug: 'tea',
  excerpt: 'text',
  gallery: ['raw', { id: 'image', url: '/image.jpg' }],
  downloads: [
    { id: 'doc', title: 'Guide', filesize: 100, filename: 'guide.pdf', url: '/guide.pdf' },
  ],
  relatedProducts: ['b', 'a', 'b', 'self', 'hidden'],
})
beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ user: null })
})
describe('public product queries', () => {
  it('returns exactly normalized card fields and preserves pagination', async () => {
    mocks.find.mockResolvedValue({ docs: [product('a')], page: 2, totalPages: 3 })
    expect(await getProductListing('cat', 2)).toEqual({
      docs: [{ id: 'a', title: 'a', slug: 'a', categorySlug: 'tea', excerpt: 'text', cover: null }],
      page: 2,
      totalPages: 3,
    })
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        limit: 12,
        page: 2,
        sort: '-publishedAt',
        depth: 1,
        draft: false,
        overrideAccess: false,
        where: {
          and: [
            expect.objectContaining({
              _status: { equals: 'published' },
              publishedAt: { less_than_equal: expect.any(String) },
            }),
            { category: { equals: 'cat' } },
          ],
        },
      }),
    )
  })
  it('normalizes detail relationships and downloads at depth one', async () => {
    mocks.find.mockResolvedValue({ docs: [product('self')] })
    const result = await getProductBySlug('self', { draft: false })
    expect(result?.category?.id).toBe('cat')
    expect(result?.gallery).toEqual([{ id: 'image', url: '/image.jpg' }])
    expect(result?.downloads).toEqual([
      { id: 'doc', title: 'Guide', size: 100, format: 'pdf', url: '/guide.pdf' },
    ])
    expect(mocks.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ depth: 1, overrideAccess: false, draft: false }),
    )
  })
  it('authorizes draft reads outside cache and refuses anonymous users', async () => {
    expect(await getProductBySlug('self', { draft: true })).toBeNull()
    expect(mocks.find).not.toHaveBeenCalled()
    mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
    mocks.find.mockResolvedValue({ docs: [product('self')] })
    expect((await getProductBySlug('self', { draft: true }))?.id).toBe('self')
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ draft: true, overrideAccess: false, user: { id: 'editor' } }),
    )
    expect(mocks.cache).not.toHaveBeenCalled()
  })
  it('keeps handpicked order, excludes self and duplicates, fills only same category', async () => {
    mocks.find
      .mockResolvedValueOnce({ docs: [product('a'), product('b')] })
      .mockResolvedValueOnce({ docs: [product('c')] })
    const { toProductDetail } = await import('@/utilities/products/models')
    expect(
      (await getRelatedProducts(toProductDetail(product('self') as never))).map((x) => x.id),
    ).toEqual(['b', 'a', 'c'])
    expect(mocks.find.mock.calls[1][0].where.and).toContainEqual({ category: { equals: 'cat' } })
    expect(mocks.cache).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ revalidate: 600, tags: expect.arrayContaining(['products-list']) }),
    )
  })
  it('scans every category and product page for visible counts and static params', async () => {
    mocks.find.mockImplementation(async ({ collection, page = 1 }) =>
      collection === 'product-categories'
        ? {
            docs: page === 1 ? [category] : [{ ...category, id: 'empty', slug: 'empty' }],
            hasNextPage: page === 1,
          }
        : { docs: [product(String(page))], hasNextPage: page === 1 },
    )
    expect(await getProductCategoriesOverview()).toEqual([
      expect.objectContaining({ id: 'cat', productCount: 2 }),
    ])
    expect(await getProductStaticParams()).toEqual({
      categories: ['tea'],
      products: [
        { category: 'tea', product: '1' },
        { category: 'tea', product: '2' },
      ],
    })
    for (const [args] of mocks.find.mock.calls)
      expect(args).toEqual(expect.objectContaining({ overrideAccess: false, draft: false }))
  })
  it('does not truncate static generation or counts after the first hundred products', async () => {
    mocks.find.mockImplementation(async ({ collection, page = 1 }) =>
      collection === 'product-categories'
        ? { docs: [category] }
        : {
            docs:
              page === 1
                ? Array.from({ length: 100 }, (_, index) => product(String(index)))
                : [product('last')],
            hasNextPage: page === 1,
          },
    )
    expect((await getProductCategoriesOverview())[0].productCount).toBe(101)
    const params = await getProductStaticParams()
    expect(params.products).toHaveLength(101)
    expect(params.products[100]).toEqual({ category: 'tea', product: 'last' })
  })
  it.each([null, 'cat'])('handles an absent or unpopulated category %s across queries', async (categoryValue) => {
    const item = { ...product('orphan'), category: categoryValue }
    mocks.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'product-categories' ? [category] : [item],
    }))
    expect(await getProductCategoriesOverview()).toHaveLength(categoryValue ? 1 : 0)
    const params = await getProductStaticParams()
    expect(params.categories).toEqual(categoryValue ? ['tea'] : [])
    const detail = await getProductBySlug('orphan')
    expect(detail?.category).toBeNull()
    mocks.find.mockClear()
    expect(await getRelatedProducts({ ...detail!, relatedProducts: [] })).toEqual([])
    expect(mocks.find).not.toHaveBeenCalled()
  })
  it('returns null for a category with no visible products', async () => {
    mocks.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'products' ? [] : [category],
    }))
    expect(await getProductCategoryBySlug('tea')).toBeNull()
  })
  it('filters hidden, undated and future products using a fresh publication cutoff', async () => {
    const fixtures = [
      { ...product('visible'), _status: 'published', publishedAt: '2020-01-01' },
      { ...product('draft'), _status: 'draft', publishedAt: '2020-01-01' },
      { ...product('future'), _status: 'published', publishedAt: '2999-01-01' },
      { ...product('undated'), _status: 'published', publishedAt: null },
    ]
    mocks.find.mockImplementation(async ({ collection, where }) => {
      if (collection === 'product-categories') return { docs: [category] }
      const visibility = where.and[0]
      expect(visibility._status.equals).toBe('published')
      const cutoff = new Date(visibility.publishedAt.less_than_equal).getTime()
      expect(Math.abs(Date.now() - cutoff)).toBeLessThan(1000)
      return {
        docs: fixtures.filter(
          (item) =>
            item._status === visibility._status.equals &&
            item.publishedAt &&
            new Date(item.publishedAt).getTime() <= cutoff,
        ),
      }
    })
    expect(await getProductStaticParams()).toEqual({
      categories: ['tea'],
      products: [{ category: 'tea', product: 'visible' }],
    })
  })
  it('returns empty listing and static params without inventing categories', async () => {
    mocks.find.mockResolvedValue({ docs: [], page: 1, totalPages: 1 })
    expect(await getProductListing('cat', 1)).toEqual({ docs: [], page: 1, totalPages: 1 })
    expect(await getProductStaticParams()).toEqual({ categories: [], products: [] })
    expect(await getProductBySlug('missing', { draft: false })).toBeNull()
  })
  it('normalizes listing SEO and rejects unsafe image URLs', async () => {
    mocks.settings.mockResolvedValue({
      product: {
        seo: { title: ' Tea ', description: ' Range ', image: { url: 'javascript:alert(1)' } },
      },
    })
    expect(await getProductListingSEO()).toEqual({ title: 'Tea', description: 'Range' })
  })
})
