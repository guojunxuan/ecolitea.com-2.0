import { createRequire } from 'node:module'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
const { find, cache } = vi.hoisted(() => ({ find: vi.fn(), cache: vi.fn((fn) => fn) }))
vi.mock('payload', () => ({ getPayload: async () => ({ find }) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/cache', () => ({ unstable_cache: cache }))
const sitemapConfig = createRequire(import.meta.url)('../../next-sitemap.config.cjs')
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://products.example.test')
  find.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
})
const entries = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  expect(doc.querySelector('parsererror')).toBeNull()
  return [...doc.querySelectorAll('url')].map((node) => ({
    loc: node.querySelector('loc')?.textContent,
    lastmod: node.querySelector('lastmod')?.textContent,
  }))
}
describe('Products sitemap', () => {
  it('registers and excludes the endpoint', () => {
    expect(sitemapConfig.exclude).toContain('/products-sitemap.xml')
    expect(sitemapConfig.robotsTxtOptions.additionalSitemaps).toContain(
      `${sitemapConfig.siteUrl}/products-sitemap.xml`,
    )
  })
  it('paginates both collections and emits only three URL kinds with updatedAt dates', async () => {
    find.mockImplementation(async ({ collection, page, where, overrideAccess, draft }) => {
      expect(overrideAccess).toBe(false)
      if (collection === 'product-categories')
        return {
          docs:
            page === 1
              ? [
                  { id: 'a', slug: 'green', updatedAt: '2026-01-01' },
                  { id: 'empty', slug: 'empty' },
                ]
              : [{ id: 'b', slug: 'black', updatedAt: '2026-01-02' }],
          hasNextPage: page === 1,
        }
      expect(draft).toBe(false)
      expect(where).toMatchObject({
        _status: { equals: 'published' },
        publishedAt: { less_than_equal: expect.any(String) },
      })
      return {
        docs: [
          {
            slug: page === 1 ? 'tea' : 'cup',
            categorySlug: page === 1 ? 'green' : 'black',
            category: page === 1 ? 'a' : 'b',
            updatedAt: '2026-02-01',
          },
        ],
        hasNextPage: page === 1,
      }
    })
    const { GET } = await import('@/app/(frontend)/(sitemaps)/products-sitemap.xml/route')
    const response = await GET()
    expect(response.headers.get('content-type')).toContain('xml')
    expect(entries(await response.text())).toEqual([
      { loc: 'https://products.example.test/products', lastmod: undefined },
      { loc: 'https://products.example.test/products/green', lastmod: '2026-01-01' },
      { loc: 'https://products.example.test/products/black', lastmod: '2026-01-02' },
      { loc: 'https://products.example.test/products/green/tea', lastmod: '2026-02-01' },
      { loc: 'https://products.example.test/products/black/cup', lastmod: '2026-02-01' },
    ])
    expect(find.mock.calls.map(([args]) => [args.collection, args.page])).toEqual([
      ['product-categories', 1],
      ['product-categories', 2],
      ['products', 1],
      ['products', 2],
    ])
    expect(cache).toHaveBeenCalledWith(
      expect.any(Function),
      ['products-sitemap'],
      expect.objectContaining({ tags: ['products-sitemap'] }),
    )
  })
  it('escapes XML and omits products with missing paths and their empty categories', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://products.example.test?x=1&y=2')
    find.mockImplementation(async ({ collection }) => ({
      docs:
        collection === 'product-categories'
          ? [
              { id: 'a', slug: 'tea&coffee' },
              { id: 'bad', slug: 'bad' },
            ]
          : [
              { slug: 'cup&tea', categorySlug: 'tea&coffee', category: 'a' },
              { slug: 'broken', category: 'bad' },
            ],
      hasNextPage: false,
    }))
    const { GET } = await import('@/app/(frontend)/(sitemaps)/products-sitemap.xml/route')
    const xml = await (await GET()).text()
    expect(xml).toContain('x=1&amp;y=2')
    expect(entries(xml).map(({ loc }) => loc)).toEqual([
      'https://products.example.test?x=1&y=2/products',
      'https://products.example.test?x=1&y=2/products/tea%26coffee',
      'https://products.example.test?x=1&y=2/products/tea%26coffee/cup%26tea',
    ])
  })
})
