import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { localizeMetadata, localizeSitemap, readySourceIDs } from '@/utilities/i18n/seo'

const { configured } = vi.hoisted(() => ({
  configured: { publicLocales: [{ code: 'en', label: 'English', status: 'source' }] },
}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/i18n/config', () => ({
  sourceLocale: 'en',
  isLocaleSegment: (segment: string) => /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment),
  get publicLocales() {
    return configured.publicLocales
  },
}))
const payload = (rows: Record<string, unknown>[] = [], legal: string[] = []) =>
  ({
    find: vi.fn(async () => ({ docs: rows })),
    findGlobal: vi.fn(async () => ({
      privacyPolicyPage: legal[0],
      cookiePolicyPage: legal[1],
      termsPage: legal[2],
    })),
  }) as unknown as Payload
beforeEach(() => {
  configured.publicLocales = [{ code: 'en', label: 'English', status: 'source' }]
})
const multilingual = () =>
  configured.publicLocales.push({ code: 'de', label: 'Deutsch', status: 'live' })
describe('locale SEO', () => {
  it('preserves English metadata and sitemap objects exactly in the default configuration', async () => {
    const client = payload()
    const metadata = { title: 'Tea', openGraph: { url: '/' } }
    const entries = [{ loc: 'https://example.test/tea', lastmod: '2026-11-15' }]
    expect(
      await localizeMetadata(metadata, {
        path: '/tea',
        locale: 'en',
        sourceCollection: 'pages',
        sourceId: 'p1',
        payload: client,
      }),
    ).toBe(metadata)
    expect(
      await localizeSitemap(
        entries.map((entry) => ({ entry, sourceCollection: 'pages', sourceId: 'p1' })),
        client,
      ),
    ).toEqual(entries)
    expect(client.find).not.toHaveBeenCalled()
    expect(client.findGlobal).not.toHaveBeenCalled()
  })
  it('emits self canonical and reciprocal ready hreflang with x-default', async () => {
    multilingual()
    const client = payload([
      { sourceId: 'p1', locale: 'de', lastReadySourceVersion: 'v1', fields: { title: 'Tee' } },
    ])
    expect(
      await localizeMetadata(
        { title: 'Tee', openGraph: { title: 'Tee' } },
        {
          path: '/tea',
          locale: 'de',
          sourceCollection: 'pages',
          sourceId: 'p1',
          payload: client,
          siteURL: 'https://example.test',
        },
      ),
    ).toMatchObject({
      alternates: {
        canonical: '/de/tea',
        languages: {
          en: 'https://example.test/tea',
          de: 'https://example.test/de/tea',
          'x-default': 'https://example.test/tea',
        },
      },
      openGraph: { url: '/de/tea' },
    })
  })
  it('excludes missing checkpoints and keeps designated legal pages English-only', async () => {
    multilingual()
    const client = payload(
      [{ sourceId: 'p1', locale: 'de', lastReadySourceVersion: 'v1', fields: {} }],
      ['p1'],
    )
    const sitemap = await localizeSitemap(
      [
        {
          entry: { loc: 'https://example.test/policy' },
          sourceCollection: 'pages',
          sourceId: 'p1',
        },
        {
          entry: { loc: 'https://example.test/unready' },
          sourceCollection: 'pages',
          sourceId: 'p2',
        },
      ],
      client,
    )
    expect(sitemap.map(({ loc }) => loc)).toEqual([
      'https://example.test/policy',
      'https://example.test/unready',
    ])
    expect(sitemap[0].alternateRefs?.map(({ hreflang }) => hreflang)).toEqual(['en', 'x-default'])
  })
  it('lists every translated sitemap URL with identical self-inclusive alternate refs', async () => {
    multilingual()
    const client = payload([
      {
        sourceId: 'b1',
        locale: 'de',
        lastReadySourceVersion: 'older-ready',
        status: 'pending',
        fields: {},
      },
    ])
    const sitemap = await localizeSitemap(
      [
        {
          entry: { loc: 'https://example.test/blogs/tea', lastmod: '2026-11-15' },
          sourceCollection: 'blogs',
          sourceId: 'b1',
        },
      ],
      client,
    )
    expect(sitemap.map(({ loc }) => loc)).toEqual([
      'https://example.test/blogs/tea',
      'https://example.test/de/blogs/tea',
    ])
    expect(sitemap[0].alternateRefs).toEqual(sitemap[1].alternateRefs)
    expect(sitemap[1].alternateRefs).toEqual([
      { hreflang: 'en', href: 'https://example.test/blogs/tea' },
      { hreflang: 'de', href: 'https://example.test/de/blogs/tea' },
      { hreflang: 'x-default', href: 'https://example.test/blogs/tea' },
    ])
  })
  it('filters static generation by locale checkpoint and legal status', async () => {
    multilingual()
    const client = payload(
      [
        { sourceId: 'p1', locale: 'de', lastReadySourceVersion: 'v1', fields: {} },
        { sourceId: 'p2', locale: 'de', lastReadySourceVersion: 'v1', fields: {} },
      ],
      ['p1'],
    )
    expect([...(await readySourceIDs(client, 'pages', ['p1', 'p2', 'p3'], 'de'))]).toEqual(['p2'])
    expect([...(await readySourceIDs(client, 'pages', ['p1', 'p2', 'p3'], 'en'))]).toEqual([
      'p1',
      'p2',
      'p3',
    ])
  })
})
