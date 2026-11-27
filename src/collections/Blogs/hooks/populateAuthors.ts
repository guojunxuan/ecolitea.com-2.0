import type { CollectionAfterReadHook } from 'payload'
import type { Blog } from '@/payload-types'

// Users are private. Publish only the explicitly selected author identity fields.
export const populateAuthors: CollectionAfterReadHook<Blog> = async ({ doc, req }) => {
  doc.populatedAuthors = []
  for (const author of doc.authors || []) {
    const user = await req.payload.findByID({
      collection: 'users',
      id: typeof author === 'object' ? author.id : author,
      select: { id: true, name: true },
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    // Deleted authors are expected; database and other lookup failures must propagate.
    if (user) doc.populatedAuthors.push({ id: user.id, name: user.name })
  }
  return doc
}
