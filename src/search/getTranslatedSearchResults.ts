import type { Payload, Where } from 'payload'
import type { CardBlogData } from '@/components/Card'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { getLocalizedDoc } from '@/utilities/i18n/getLocalized'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'

/** The private index locates candidates; public source reads and retained ready
 * checkpoints decide what can be rendered. Do not trust an index row after unpublish. */
export async function getTranslatedSearchResults(
  payload: Payload,
  query: string,
  locale: string,
): Promise<CardBlogData[]> {
  const { publicLocales } = await getI18nSettings(payload)
  const blogs: CardBlogData[] = []
  if (!publicLocales.some(({ code }) => code === locale) || locale === 'en') return blogs
  const now = new Date()
  const where: Where = {
    and: [
      { locale: { equals: locale } },
      { ready: { equals: true } },
      { sourceCollection: { equals: 'blogs' } },
      ...(query
        ? [
            {
              or: [
                { title: { like: query } },
                { excerpt: { like: query } },
                { path: { like: query } },
              ],
            },
          ]
        : []),
    ],
  }
  let page = 1
  let hasNextPage: boolean
  do {
    // Filtering precedes the display limit, including stale/private index entries.
    const indexed = await payload.find({
      collection: 'translation-search',
      where,
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      sort: 'id',
    })
    hasNextPage = indexed.hasNextPage
    page++
    const candidates = indexed.docs.filter(({ sourceCollection }) => sourceCollection === 'blogs')
    if (!candidates.length) continue

    const result = await payload.find({
      collection: 'blogs',
      overrideAccess: false,
      draft: false,
      depth: 1,
      pagination: false,
      where: {
        and: [
          { id: { in: candidates.map(({ sourceId }) => sourceId) } },
          publicBlogVisibility(now),
        ],
      },
    })
    const sourceDocs = new Map(result.docs.map((doc) => [doc.id, doc]))
    for (const row of candidates) {
      const doc = sourceDocs.get(row.sourceId)
      if (!doc) continue
      const localized = await getLocalizedDoc(doc, 'blogs', locale, payload)
      // Pending or failed work may retain a last-ready translation.
      if (!localized) continue
      blogs.push(localized)
      if (blogs.length === 12) return blogs
    }
  } while (hasNextPage)
  return blogs
}
