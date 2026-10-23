import type { Where } from 'payload'
export const publicProductVisibility = (now: Date): Where => ({
  _status: { equals: 'published' },
  publishedAt: { less_than_equal: now.toISOString() },
})
