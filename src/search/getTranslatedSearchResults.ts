import type { Payload, Where } from 'payload'
import type { Blog, Post } from '@/payload-types'
import type { CardBlogData, CardPostData } from '@/components/Card'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { getLocalizedDoc } from '@/utilities/i18n/getLocalized'
import { publicSourceVisibility } from '@/utilities/i18n/publicSourceVisibility'

/** The private index locates candidates; public source reads and retained ready
 * checkpoints decide what can be rendered. Do not trust an index row after unpublish. */
export async function getTranslatedSearchResults(payload: Payload, query: string, locale: string) {
  const { publicLocales } = await getI18nSettings(payload)
  const blogs: CardBlogData[] = []
  const posts: CardPostData[] = []
  if (!publicLocales.some(({ code }) => code === locale) || locale === 'en') return { blogs, posts }
  const where: Where = {
    and: [
      { locale: { equals: locale } },
      { ready: { equals: true } },
      { sourceCollection: { in: ['blogs', 'posts'] } },
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
    const sourceDocs = new Map<string, Blog | Post>()
    for (const collection of ['blogs', 'posts'] as const) {
      const ids = indexed.docs
        .filter((row) => row.sourceCollection === collection)
        .map((row) => row.sourceId)
      if (!ids.length) continue
      const result = await payload.find({
        collection,
        overrideAccess: false,
        draft: false,
        depth: 1,
        pagination: false,
        where: { and: [{ id: { in: ids } }, publicSourceVisibility(collection)] },
      })
      for (const doc of result.docs) sourceDocs.set(`${collection}:${doc.id}`, doc)
    }
    for (const row of indexed.docs) {
      const doc = sourceDocs.get(`${row.sourceCollection}:${row.sourceId}`)
      if (!doc) continue
      const localized = await getLocalizedDoc(doc, row.sourceCollection, locale, payload)
      // The translation row may be pending/failed but still have a last-ready
      // checkpoint. getLocalizedDoc owns that decision, not status === ready.
      if (!localized) continue
      if (row.sourceCollection === 'blogs') blogs.push(localized as Blog)
      else posts.push(localized as Post)
      if (blogs.length + posts.length === 12) return { blogs, posts }
    }
    hasNextPage = indexed.hasNextPage
    page++
  } while (hasNextPage)
  return { blogs, posts }
}
