import type { Where } from 'payload'

// The search plugin indexes published Blogs and removes rows without a published version.
// Keep future rows indexed so this date check makes them visible when their time arrives.
export const publicSearchVisibility = (now: Date): Where => ({
  or: [
    { 'doc.relationTo': { equals: 'posts' } },
    {
      and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ],
    },
  ],
})
