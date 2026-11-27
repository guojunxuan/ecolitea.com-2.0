import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import type { ISitemapField } from 'next-sitemap'
import type { Payload } from 'payload'
import { localeCatalog } from '@/i18n/catalog'
import { sourceLocale } from '@/i18n/config'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { localePath } from '@/i18n/paths'
import { getServerSideURL } from '@/utilities/getURL'

type Source = { sourceCollection?: string; sourceId?: string }
type SitemapSource = Source & { entry: ISitemapField }

async function client(): Promise<Payload> {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])
  return getPayload({ config })
}

async function legalIDs(payload: Payload): Promise<Set<string>> {
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: false,
    draft: false,
  })
  return new Set(
    [settings.privacyPolicyPage, settings.cookiePolicyPage, settings.termsPage]
      .filter(Boolean)
      .map((value) => String(typeof value === 'object' ? value?.id : value)),
  )
}

/** Sources are already public-filtered by the owning reader. Match the read boundary's
 * retained last-ready checkpoint rather than the newest request's transient status. */
export async function readySourceIDs(
  payload: Payload,
  sourceCollection: string,
  ids: string[],
  locale: string,
): Promise<Set<string>> {
  const { publicLocales } = await getI18nSettings(payload)
  if (locale === sourceLocale) return new Set(ids)
  if (!ids.length || !publicLocales.some(({ code }) => code === locale)) return new Set()
  const [result, legal] = await Promise.all([
    payload.find({
      collection: 'translations',
      depth: 0,
      overrideAccess: true,
      pagination: false,
      limit: ids.length,
      where: {
        and: [
          { sourceCollection: { equals: sourceCollection } },
          { sourceId: { in: ids } },
          { locale: { equals: locale } },
          { lastReadySourceVersion: { exists: true } },
        ],
      },
    }),
    sourceCollection === 'pages' ? legalIDs(payload) : Promise.resolve(new Set<string>()),
  ])
  return new Set(
    result.docs
      .filter(
        (row) =>
          row.locale === locale &&
          ids.includes(row.sourceId) &&
          !legal.has(row.sourceId) &&
          Boolean(row.lastReadySourceVersion) &&
          row.fields &&
          typeof row.fields === 'object' &&
          !Array.isArray(row.fields),
      )
      .map((row) => row.sourceId),
  )
}

async function availableLocales(source: Source, payload?: Payload): Promise<string[]> {
  const { publicLocales } = await getI18nSettings(payload)
  if (!source.sourceCollection) return publicLocales.map(({ code }) => code)
  if (!source.sourceId) return [sourceLocale]
  const codes = publicLocales.map(({ code }) => code)
  return unstable_cache(
    async () => {
      const instance = payload ?? (await client())
      const ready = await Promise.all(
        codes.map(async (code) =>
          (await readySourceIDs(instance, source.sourceCollection!, [source.sourceId!], code)).has(
            source.sourceId!,
          )
            ? code
            : null,
        ),
      )
      return ready.filter((locale): locale is string => locale !== null)
    },
    ['i18n-seo-availability', source.sourceCollection, source.sourceId, ...codes],
    {
      tags: [
        'translations-sitemap',
        ...codes.flatMap((code) => [
          `translations:${code}`,
          `translation:${source.sourceCollection}:${source.sourceId}:${code}`,
        ]),
      ],
    },
  )()
}

export async function localizeMetadata(
  metadata: Metadata,
  options: Source & {
    path: string
    locale?: string
    payload?: Payload
    siteURL?: string
    draft?: boolean
  },
): Promise<Metadata> {
  const { path, locale = sourceLocale, draft = false } = options
  const { publicLocales } = await getI18nSettings(options.payload)
  // The default deployment must retain its existing SEO output byte-for-byte.
  if (draft || (publicLocales.length === 1 && locale === sourceLocale)) return metadata
  const codes = await availableLocales(options, options.payload)
  const canonical = localePath(path, codes.includes(locale) ? locale : sourceLocale)
  const siteURL = options.siteURL ?? getServerSideURL()
  const languages = Object.fromEntries(
    codes.map((code) => [code, new URL(localePath(path, code), siteURL).toString()]),
  )
  languages['x-default'] = new URL(path, siteURL).toString()
  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical, languages },
    ...(metadata.openGraph ? { openGraph: { ...metadata.openGraph, url: canonical } } : {}),
  }
}

/** Every language URL gets the same self-inclusive links, as required by Google's
 * localized sitemap format. English-only deployments keep their prior entries. */
export async function localizeSitemap(
  sources: SitemapSource[],
  payload: Payload,
): Promise<ISitemapField[]> {
  const { publicLocales } = await getI18nSettings(payload)
  if (publicLocales.length === 1) return sources.map(({ entry }) => entry)
  const collections = [
    ...new Set(
      sources.flatMap(({ sourceCollection }) => (sourceCollection ? [sourceCollection] : [])),
    ),
  ]
  const availability = new Map<string, Set<string>>()
  await Promise.all(
    collections.flatMap((sourceCollection) => {
      const ids = sources
        .filter((source) => source.sourceCollection === sourceCollection)
        .flatMap(({ sourceId }) => (sourceId ? [sourceId] : []))
      return publicLocales.map(async ({ code }) => {
        availability.set(
          `${sourceCollection}:${code}`,
          await readySourceIDs(payload, sourceCollection, [...new Set(ids)], code),
        )
      })
    }),
  )
  return sources.flatMap(({ entry, sourceCollection, sourceId }) => {
    const codes = publicLocales
      .map(({ code }) => code)
      .filter(
        (code) =>
          !sourceCollection ||
          (sourceId && availability.get(`${sourceCollection}:${code}`)?.has(sourceId)) ||
          code === sourceLocale,
      )
    // Existing sitemap handlers escape their XML strings before serialization.
    // Adding the locale before the first path retains that escaping and the original lastmod.
    const localizedURL = (code: string) =>
      code === sourceLocale
        ? entry.loc
        : entry.loc.replace(
            /^(https?:\/\/[^/]+)(\/|$)/,
            (_match, origin: string, slash: string) => `${origin}/${code}${slash}`,
          )
    const alternateRefs = [
      ...codes.map((code) => ({ hreflang: code, href: localizedURL(code) })),
      { hreflang: 'x-default', href: entry.loc },
    ]
    return codes.map((code) => ({ ...entry, loc: localizedURL(code), alternateRefs }))
  })
}

export const sitemapLocaleTags = () => [
  'global_site-settings',
  'translations-sitemap',
  ...localeCatalog.map(({ code }) => `translations:${code}`),
]

export const sitemapLocaleKey = () => ['site-settings-locales']
