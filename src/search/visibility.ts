import type { SearchPluginConfig } from '@payloadcms/plugin-search/types'
import type { Where } from 'payload'

export const publicSearchVisibility = (now: Date): Where => ({
  or: [
    { 'doc.relationTo': { equals: 'posts' } },
    {
      and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { blogStatus: { equals: 'published' } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ],
    },
  ],
})

export const skipInvisibleBlogSync: NonNullable<SearchPluginConfig['skipSync']> = async ({ collectionSlug, doc, req }) => {
  // The search plugin handles drafts and their published versions itself.
  if (collectionSlug !== 'blogs' || doc._status !== 'published') return false

  const publishedAt = typeof doc.publishedAt === 'string' ? Date.parse(doc.publishedAt) : NaN
  if (Number.isFinite(publishedAt) && publishedAt <= Date.now()) return false

  // skipSync alone leaves a previously indexed row in place after a date change.
  await req.payload.delete({
    collection: 'search',
    depth: 0,
    req,
    where: {
      and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { 'doc.value': { equals: doc.id } },
      ],
    },
  })
  return true
}
