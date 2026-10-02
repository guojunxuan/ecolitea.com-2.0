import type { CollectionAfterReadHook } from 'payload'
import type { Blog } from '@/payload-types'

// Users are private. Publish only the explicitly selected author identity fields.
export const populateAuthors: CollectionAfterReadHook<Blog> = async ({ doc, req }) => {
  doc.populatedAuthors = []
  for (const author of doc.authors || []) {
    try {
      const user = await req.payload.findByID({
        collection: 'users',
        id: typeof author === 'object' ? author.id : author,
        select: { id: true, name: true },
        depth: 0,
        overrideAccess: true,
        req,
      })
      doc.populatedAuthors.push({ id: user.id, name: user.name })
    } catch {
      // Deleted authors do not prevent public content from loading.
    }
  }
  return doc
}
