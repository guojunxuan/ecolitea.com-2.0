import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
export const revalidateCategories: CollectionAfterChangeHook = ({ doc, previousDoc, req: { context } }) => {
  if (context.disableRevalidate) return doc
  if (doc?.slug) revalidatePath(`/categories/${doc.slug}`)
  if (previousDoc?.slug && previousDoc.slug !== doc?.slug) revalidatePath(`/categories/${previousDoc.slug}`)
  revalidatePath('/posts'); revalidatePath('/search'); revalidateTag('categories', 'max'); return doc
}
export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) { if (doc?.slug) revalidatePath(`/categories/${doc.slug}`); revalidatePath('/posts'); revalidatePath('/search'); revalidateTag('categories', 'max') }
  return doc
}
