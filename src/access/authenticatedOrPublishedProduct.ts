import type { Access } from 'payload'

export const authenticatedOrPublishedProduct: Access = ({ req: { user } }) => {
  if (user) return true

  return {
    _status: { equals: 'published' },
    publishedAt: { exists: true, less_than_equal: new Date().toISOString() },
  }
}
