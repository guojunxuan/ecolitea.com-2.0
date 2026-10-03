import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Blog } from '@/payload-types'

const invalidateBlog = async (docs: Blog[], req: PayloadRequest) => {
  const categoryIDs = new Set<string>()
  for (const doc of docs) {
    revalidatePath(`/blogs/${doc.slug}`)
    revalidateTag(`blog-${doc.id}`, 'max')
    if (doc.category)
      categoryIDs.add(typeof doc.category === 'object' ? doc.category.id : doc.category)
  }
  for (const id of categoryIDs) {
    revalidateTag(`blog-category-${id}`, 'max')
    const category = await req.payload.findByID({
      collection: 'blog-categories',
      id,
      depth: 0,
      select: { slug: true },
      disableErrors: true,
      req,
    })
    if (category?.slug) revalidatePath(`/blogs/category/${category.slug}`)
  }
  revalidatePath('/blogs')
  revalidatePath('/search')
  // All paginated and category listing queries share this tag.
  revalidateTag('blogs-list', 'max')
  revalidateTag('blogs-sitemap', 'max')
}

export const revalidateBlog: CollectionAfterChangeHook<Blog> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context.disableRevalidate) return doc
  const published = [previousDoc, doc].filter((item): item is Blog => item?._status === 'published')
  if (published.length) {
    await invalidateBlog(published, req)
    if (
      previousDoc &&
      (previousDoc.slug !== doc.slug ||
        previousDoc._status !== doc._status ||
        previousDoc.publishedAt !== doc.publishedAt)
    ) {
      // Cached redirect responses depend on the shared redirects data tag.
      // Block on fresh data so the next 308 cannot retain the old destination.
      revalidateTag('redirects', { expire: 0 })
    }
  }
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook<Blog> = async ({ doc, req }) => {
  if (!req.context.disableRevalidate && doc._status === 'published') {
    await invalidateBlog([doc], req)
    revalidateTag('redirects', { expire: 0 })
  }
  return doc
}
