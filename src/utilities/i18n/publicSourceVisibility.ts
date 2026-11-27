import type { Where } from 'payload'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import { publicProductVisibility } from '@/utilities/products/publicVisibility'

/** Apply the public collection rules before translated search/redirect consumption. */
export function publicSourceVisibility(collection: string, now = new Date()): Where {
  if (collection === 'blogs') return publicBlogVisibility(now)
  if (collection === 'products') return publicProductVisibility(now)
  return ['pages', 'case-studies'].includes(collection) ? { _status: { equals: 'published' } } : {}
}

export function isPublicSource(
  doc: Record<string, unknown>,
  collection: string,
  now = new Date(),
): boolean {
  if (
    ['pages', 'blogs', 'products', 'case-studies'].includes(collection) &&
    doc._status !== 'published'
  )
    return false
  if (['blogs', 'products'].includes(collection) && typeof doc.publishedAt !== 'string')
    return false
  if (
    ['blogs', 'products'].includes(collection) &&
    typeof doc.publishedAt === 'string'
  )
    return Date.parse(doc.publishedAt) <= now.getTime()
  return true
}
