import type { Access } from 'payload'

export const authenticatedOrPublishedBlog: Access = ({ req: { user } }) => {
  if (user) return true

  // Evaluate the cutoff per request so scheduled dates become readable when due.
  return {
    _status: { equals: 'published' },
    publishedAt: { exists: true, less_than_equal: new Date().toISOString() },
  }
}
