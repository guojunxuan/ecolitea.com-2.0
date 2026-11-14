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
  resources: [
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
    expect(result?.specifications).toEqual([
      { group: null, items: [{ label: 'Origin', value: 'China' }] },
    ])
    expect(result?.overview).toEqual(['text'])
    expect(result?.downloads).toEqual([
      { id: 'doc', title: 'Guide', url: '/guide.pdf', filesize: 100, mimeType: null },
    ])
    expect(result).not.toHaveProperty('excerpt')
    expect(result).not.toHaveProperty('specs')
    expect(result?.category?.id).toBe('cat')
    expect(result?.gallery).toEqual([{ id: 'image', url: '/image.jpg' }])
    for (const field of ['layout', 'content', 'faqs', 'highlights', 'options'])
      expect(result).not.toHaveProperty(field)
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
          documents: { title: true, url: true, filename: true, mimeType: true, filesize: true },
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
  it('normalizes overview paragraphs, grouped specifications and ordered downloads', async () => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          ...product('self'),
          overview: ' First line\r\nContinued \r\n  \r\n Second paragraph \n\n',
          specifications: [
            {
              group: '  Build ',
              items: [
                { label: ' Origin ', value: ' China ' },
                { label: '', value: 'x' },
              ],
            },
            { group: 'Empty', items: [] },
            { group: ' ', items: [{ label: 'Size', value: '2' }] },
          ],
          resources: [
            'unpopulated',
            { id: 'empty', url: null },
            {
              id: 'one',
              title: ' ',
              filename: 'manual.pdf',
              url: '/files/manual.pdf',
              mimeType: 'application/pdf',
            },
            { id: 'unsafe', url: 'javascript:alert(1)' },
            { id: 'two', title: ' Specs ', url: 'https://example.test/spec.pdf', filesize: 20 },
          ],
        },
      ],
    })
    expect(await getProductBySlug('self')).toMatchObject({
      overview: ['First line\r\nContinued', 'Second paragraph'],
      specifications: [
        { group: 'Build', items: [{ label: 'Origin', value: 'China' }] },
        { group: null, items: [{ label: 'Size', value: '2' }] },
      ],
      downloads: [
        {
          id: 'one',
          title: 'manual.pdf',
          url: '/files/manual.pdf',
          mimeType: 'application/pdf',
          filesize: null,
        },
        {
          id: 'two',
          title: 'Specs',
          url: 'https://example.test/spec.pdf',
          mimeType: null,
          filesize: 20,
        },
      ],
    })
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
  it.each([1, 6, 7, 10])(
    'returns up to four normalized previews and preserves the total for %s products',
    async (count) => {
      const docs = Array.from({ length: count }, (_, index) => ({
        ...product(String(index)),
        category: index % 2 ? 'cat' : category,
        gallery: index === 6 ? ['unpopulated'] : [{ id: `image-${index}` }],
      }))
      mocks.find.mockImplementation(async ({ collection }) => ({
        docs:
          collection === 'product-categories'
            ? [
                { ...category, image: { id: 'cover', width: 400, height: 400 } },
                { ...category, id: 'empty' },
              ]
            : docs,
      }))
      const result = await getProductCategoriesOverview()
      expect(result).toHaveLength(1)
      expect(result[0]).not.toHaveProperty('meta')
      expect(result[0]).toMatchObject({
        productCount: count,
        products: docs.slice(0, 4).map((item) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          summary: item.summary,
          categorySlug: 'tea',
          cover: typeof item.gallery[0] === 'object' ? item.gallery[0] : null,
        })),
        imageFit: 'contain',
      })
      expect(mocks.find).toHaveBeenCalledTimes(2)
      expect(mocks.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'products',
          sort: '-publishedAt',
        }),
      )
      expect(mocks.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'product-categories',
          sort: '_order',
        }),
      )
      expect(mocks.cache).toHaveBeenCalledWith(['products-overview-v2'], {
        tags: ['products-overview', 'product-categories', 'products-list'],
        revalidate: 600,
      })
    },
  )
  it('fills handpicked related products up to eight without changing selection order', async () => {
    mocks.find
      .mockResolvedValueOnce({ docs: [product('a'), product('b')] })
      .mockResolvedValueOnce({ docs: ['c', 'd', 'e', 'f', 'g', 'h'].map(product) })
    const { toProductDetail } = await import('@/utilities/products/shared')
    const result = await getRelatedProducts(toProductDetail(product('self') as never))
    expect(result.map(({ id }) => id)).toEqual(['b', 'a', 'c', 'd', 'e', 'f', 'g', 'h'])
    expect(mocks.find.mock.calls[1][0]).toMatchObject({
      limit: 6,
      sort: '-publishedAt',
      where: {
        and: [
          {
            _status: { equals: 'published' },
            publishedAt: { less_than_equal: expect.any(String) },
          },
          { category: { equals: 'cat' } },
          { id: { not_in: ['self', 'b', 'a'] } },
        ],
      },
    })
  })
  it('caps handpicked related products at eight and skips category fill when full', async () => {
    const selected = Array.from({ length: 10 }, (_, index) => `selected-${index}`)
    mocks.find.mockResolvedValue({ docs: [...selected].reverse().map(product) })
    const { toProductDetail } = await import('@/utilities/products/shared')
    const result = await getRelatedProducts(
      toProductDetail({
        ...product('self'),
        relatedProducts: ['self', ...selected, selected[0]],
      } as never),
    )
    expect(result.map(({ id }) => id)).toEqual(selected.slice(0, 8))
    expect(mocks.find).toHaveBeenCalledTimes(1)
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

it('normalizes incomplete native drafts using the same population as published reads', async () => {
  mocks.find.mockResolvedValue({
    docs: [
      { ...product('self'), overview: '  ', specifications: [{ group: 'Empty' }, { items: [{}] }] },
    ],
  })
  const detail = await getProductBySlug('self')
  const [lookup, lookupDetail] = mocks.find.mock.calls.map(([args]) => args)
  expect(lookup).toMatchObject({ depth: 0, select: {} })
  expect(detail).toMatchObject({ specifications: [], overview: ['text'] })
  mocks.auth.mockResolvedValue({ user: { id: 'editor' } })
  await getProductBySlug('self', { draft: true })
  expect(mocks.find.mock.calls.at(-1)![0].populate).toEqual(lookupDetail.populate)
})

it('keeps all sections and preserves real product block data and order', async () => {
  const blocks = [
    {
      id: 'text',
      blockType: 'productMediaText',
      title: 'Fresh tea',
      body: { root: { type: 'root', children: [] } },
      media: { id: 'video', url: '/tea.mp4', mimeType: 'video/mp4' },
      playback: 'player',
      mediaPosition: 'left',
      aspectRatio: '4:5',
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
          {
            label: 'First',
            anchor: 'first',
            theme: 'inverse',
            title: '  A chapter title  ',
            description: '  Chapter introduction  ',
            blocks,
          },
          { label: 'Missing', anchor: 'missing' },
          { label: 'Second', anchor: 'second', blocks },
        ],
      },
    ],
  })
  const detail = await getProductBySlug('self')
  expect(detail?.sections).toEqual([
    {
      label: 'Empty',
      anchor: 'empty',
      theme: 'default',
      title: null,
      description: null,
      blocks: [],
    },
    {
      label: 'First',
      anchor: 'first',
      theme: 'inverse',
      title: 'A chapter title',
      description: 'Chapter introduction',
      blocks,
    },
    {
      label: 'Missing',
      anchor: 'missing',
      theme: 'default',
      title: null,
      description: null,
      blocks: [],
    },
    {
      label: 'Second',
      anchor: 'second',
      theme: 'default',
      title: null,
      description: null,
      blocks,
    },
  ])
  for (const field of ['layout', 'content', 'faqs', 'highlights', 'options'])
    expect(detail).not.toHaveProperty(field)
  expect(mocks.find).toHaveBeenLastCalledWith(
    expect.objectContaining({
      depth: 2,
      populate: expect.objectContaining({
        media: expect.objectContaining({ url: true, mimeType: true }),
      }),
    }),
  )
})

it('deduplicates populated gallery images in their original order', async () => {
  mocks.find.mockResolvedValue({
    docs: [
      { ...product('dedup'), gallery: [{ id: 'base' }, { id: 'second' }, { id: 'base' }, 'raw'] },
    ],
  })
  expect((await getProductBySlug('dedup'))?.gallery).toEqual([{ id: 'base' }, { id: 'second' }])
})
