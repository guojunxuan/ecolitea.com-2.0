import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { find, findGlobal, cache } = vi.hoisted(() => ({
  find: vi.fn(),
  findGlobal: vi.fn(),
  cache: vi.fn((fn: unknown) => fn),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ find, findGlobal }) }))
vi.mock('next/cache', () => ({ unstable_cache: cache }))
vi.mock('@/i18n/getI18nSettings', () => ({
  getI18nSettings: async () => ({
    publicLocales: [
      { code: 'en', status: 'source' },
      { code: 'de', status: 'live' },
    ],
    targetLocales: [{ code: 'de', status: 'live' }],
    regions: [],
  }),
}))
vi.mock('@/i18n/config', () => ({
  sourceLocale: 'en',
  isLocaleSegment: (segment: string) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment),
  publicLocales: [
    { code: 'en', label: 'English', status: 'source' },
    { code: 'de', label: 'Deutsch', status: 'live' },
  ],
}))
beforeEach(() => {
  cache.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://example.test')
  findGlobal.mockResolvedValue({ privacyPolicyPage: 'legal' })
  find.mockImplementation(
    async ({
      collection,
      where,
    }: {
      collection: string
      where?: { and?: { sourceId?: { in: string[] } }[] }
    }) => {
      if (collection === 'translations') {
        const ids = where?.and?.find((item) => item.sourceId)?.sourceId?.in ?? []
        return {
          docs: ids
            .filter((id) => id !== 'unready')
            .map((sourceId) => ({
              sourceId,
              locale: 'de',
              lastReadySourceVersion: 'ready',
              fields: {},
            })),
        }
      }
      const doc = {
        id: collection === 'pages' ? 'legal' : collection,
        slug: 'tea',
        categorySlug: 'green',
        category: 'product-categories',
        updatedAt: '2026-11-15',
      }
      return {
        docs: collection.endsWith('categories')
          ? [{ ...doc, slug: 'green' }]
          : [doc, { ...doc, id: 'unready', slug: 'unready' }],
        hasNextPage: false,
      }
    },
  )
})
afterEach(() => vi.unstubAllEnvs())
describe('translated sitemap HTTP responses', () => {
  it.each(['pages', 'posts', 'blogs', 'products'])(
    'lists ready %s URLs and reciprocal xhtml links only',
    async (kind) => {
      const routes = {
        pages: () => import('@/app/(frontend)/(sitemaps)/pages-sitemap.xml/route'),
        posts: () => import('@/app/(frontend)/(sitemaps)/posts-sitemap.xml/route'),
        blogs: () => import('@/app/(frontend)/(sitemaps)/blogs-sitemap.xml/route'),
        products: () => import('@/app/(frontend)/(sitemaps)/products-sitemap.xml/route'),
      }
      const { GET } = await routes[kind as keyof typeof routes]()
      expect(cache).toHaveBeenCalledWith(
        expect.any(Function),
        [`${kind}-sitemap`, 'site-settings-locales'],
        expect.objectContaining({
          tags: expect.arrayContaining([
            'global_site-settings',
            'translations-sitemap',
            'translations:de',
          ]),
        }),
      )
      const response = await GET()
      const xml = await response.text()
      const document = new DOMParser().parseFromString(xml, 'application/xml')
      expect(document.querySelector('parsererror')).toBeNull()
      const urls = [...document.querySelectorAll('url')]
      const locations = urls.map((url) => url.querySelector('loc')?.textContent)
      expect(locations.some((loc) => loc?.startsWith('https://example.test/de/'))).toBe(true)
      expect(locations.some((loc) => loc?.includes('/de/') && loc.includes('unready'))).toBe(false)
      expect(locations.some((loc) => loc?.includes('/fr/'))).toBe(false)
      if (kind === 'pages') expect(locations).not.toContain('https://example.test/de/tea')
      for (const url of urls) {
        const refs = [...url.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')]
        expect(refs.some((ref) => ref.getAttribute('hreflang') === 'x-default')).toBe(true)
        expect(
          refs.some((ref) => ref.getAttribute('href') === url.querySelector('loc')?.textContent),
        ).toBe(true)
      }
    },
  )
})
