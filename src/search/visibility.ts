import type { Where } from 'payload'

// Keep future rows indexed so the date check exposes them when their time arrives.
export const publicSearchVisibility = (now: Date): Where => ({
  or: [
    {
      and: [
        { 'doc.relationTo': { equals: 'blogs' } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ],
    },
    {
      and: [
        { 'doc.relationTo': { equals: 'products' } },
        { publishedAt: { less_than_equal: now.toISOString() } },
      ],
    },
  ],
})
