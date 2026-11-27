import type { Where } from 'payload'

/** A published row without publishedAt remains hidden until its date is repaired. */
export const publicBlogVisibility = (now: Date): Where => ({
  _status: { equals: 'published' },
  publishedAt: { less_than_equal: now.toISOString() },
})
