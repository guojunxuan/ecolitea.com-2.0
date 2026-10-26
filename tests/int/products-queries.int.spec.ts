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
  summary: 'text',
  specifications: [{ label: 'Origin', value: 'China' }],
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
      docs: [{ id: 'a', title: 'a', slug: 'a', categorySlug: 'tea', summary: 'text', cover: null }],
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
  it('normalizes detail relationships and excludes legacy fields at depth two', async () => {
    mocks.find.mockResolvedValue({ docs: [product('self')] })
    const result = await getProductBySlug('self', { draft: false })
    expect(result?.summary).toBe('text')
    expect(result?.specifications).toEqual([{ label: 'Origin', value: 'China' }])
    expect(result).not.toHaveProperty('excerpt')
    expect(result).not.toHaveProperty('specs')
    expect(result?.category?.id).toBe('cat')
    expect(result?.gallery).toEqual([{ id: 'image', url: '/image.jpg' }])
    for (const field of ['layout', 'downloads', 'faqs']) expect(result).not.toHaveProperty(field)
    expect(result?.sections).toEqual([])
    expect(mocks.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        depth: 2,
        overrideAccess: false,
        draft: false,
        populate: expect.objectContaining({
          media: {
            alt: true,
            url: true,
            thumbnailURL: true,
            filename: true,
            mimeType: true,
            filesize: true,
            width: true,
            height: true,
            focalX: true,
            focalY: true,
            createdAt: true,
            updatedAt: true,
          },
          'product-categories': {
            title: true,
            slug: true,
            description: true,
            image: true,
            meta: true,
          },
          products: { slug: true, categorySlug: true },
        }),
      }),
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
  it.each([undefined, null, []])(
    'normalizes absent or empty highlights %s to an empty array',
    async (highlights) => {
      mocks.find.mockResolvedValue({ docs: [{ ...product('self'), highlights }] })
      expect((await getProductBySlug('self'))?.highlights).toEqual([])
    },
  )
  it('normalizes highlight rows into ordered detail strings', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          ...product('self'),
          highlights: [
            { id: 'one', text: 'Organic tea' },
            { id: 'two', text: 'Fresh harvest' },
          ],
        },
      ],
    })
    expect((await getProductBySlug('self'))?.highlights).toEqual(['Organic tea', 'Fresh harvest'])
  })
  it('keeps handpicked order, excludes self and duplicates, fills only same category', async () => {
    mocks.find
      .mockResolvedValueOnce({ docs: [product('a'), product('b')] })
      .mockResolvedValueOnce({ docs: [product('c')] })
    const { toProductDetail } = await import('@/utilities/products/shared')
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
  it.each([null, 'cat'])(
    'handles an absent or unpopulated category %s across queries',
    async (categoryValue) => {
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
    },
  )
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

it('normalizes options and resolves defaults with shared public/draft population', async () => {
  mocks.find.mockResolvedValue({
    docs: [
      {
        ...product('self'),
        options: [
          {
            name: 'Color',
            display: 'image',
            values: [
              {
                label: 'Red',
                thumbnail: { id: 'thumb' },
                swatch: '#f00',
                gallery: ['raw', { id: 'red' }],
                specifications: [{ label: 'Origin', value: 'India' }],
              },
            ],
          },
        ],
      },
    ],
  })
  const detail = await getProductBySlug('self')
  expect(detail?.options).toEqual([
    {
      key: 'color',
      name: 'Color',
      display: 'image',
      values: [
        {
          key: 'red',
          label: 'Red',
          swatch: '#f00',
          thumbnail: { id: 'thumb' },
          gallery: [{ id: 'red' }],
          specifications: [{ label: 'Origin', value: 'India' }],
        },
      ],
    },
  ])
  expect(detail?.defaultSelection).toEqual({ color: 'red' })
  expect(detail?.resolvedGallery).toEqual([{ id: 'red' }])
  expect(detail?.resolvedSpecifications).toEqual([{ label: 'Origin', value: 'India' }])
  const args = mocks.find.mock.calls.at(-1)![0]
  expect(args.depth).toBe(2)
  const lookup = mocks.find.mock.calls[0][0]
  expect(lookup).toMatchObject({ depth: 0, select: {} })
  mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
  await getProductBySlug('self', { draft: true })
  expect(mocks.find.mock.calls.at(-1)![0].populate).toEqual(args.populate)
})
it.each([null, undefined, []])(
  'normalizes absent options %s and specification arrays',
  async (options) => {
    mocks.find.mockResolvedValue({ docs: [{ ...product('self'), options, specifications: null }] })
    const detail = await getProductBySlug('self')
    expect(detail).toMatchObject({
      options: [],
      specifications: [],
      defaultSelection: {},
      resolvedSpecifications: [],
      resolvedGallery: [{ id: 'image', url: '/image.jpg' }],
    })
  },
)
it('normalizes incomplete native drafts without missing option names crashing preview', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
  mocks.find.mockResolvedValue({ docs: [{ ...product('self'), options: [{ values: [{}] }] }] })
  const detail = await getProductBySlug('self', { draft: true })
  expect(detail?.options).toEqual([
    {
      key: '',
      name: '',
      display: 'text',
      values: [
        { key: '', label: '', swatch: null, thumbnail: null, gallery: [], specifications: [] },
      ],
    },
  ])
})

it('filters empty sections and preserves real product block data and order', async () => {
  const blocks = [
    {
      id: 'text',
      blockType: 'productMediaText',
      eyebrow: 'Harvest',
      title: 'Fresh tea',
      body: { root: { type: 'root', children: [] } },
      media: { id: 'video', url: '/tea.mp4', mimeType: 'video/mp4' },
      playback: 'player',
      mediaPosition: 'left',
      aspectRatio: '4:5',
      theme: 'inverse',
    },
    {
      id: 'code',
      blockType: 'productCode',
      label: 'Animation',
      html: '<img src="{{asset:0}}">',
      css: 'img { width: 100%; }',
      js: 'console.log("tea")',
      assets: [{ id: 'asset', url: '/tea.gif', mimeType: 'image/gif' }],
      minHeight: 720,
      width: 'full',
      theme: 'default',
    },
  ]
  mocks.find.mockResolvedValue({
    docs: [
      {
        ...product('self'),
        layout: [],
        faqs: [],
        sections: [
          { label: 'Empty', anchor: 'empty', blocks: [] },
          { label: 'First', anchor: 'first', blocks },
          { label: 'Missing', anchor: 'missing' },
          { label: 'Second', anchor: 'second', blocks },
        ],
      },
    ],
  })
  const detail = await getProductBySlug('self')
  expect(detail?.sections).toEqual([
    { label: 'First', anchor: 'first', blocks },
    { label: 'Second', anchor: 'second', blocks },
  ])
  for (const field of ['layout', 'downloads', 'faqs']) expect(detail).not.toHaveProperty(field)
  expect(mocks.find).toHaveBeenLastCalledWith(
    expect.objectContaining({
      depth: 2,
      populate: expect.objectContaining({
        media: expect.objectContaining({ url: true, mimeType: true }),
      }),
    }),
  )
})
