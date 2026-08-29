import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

export const revalidateCaseStudy: CollectionAfterChangeHook = ({ doc, previousDoc, req: { payload, context } }) => {
  if (context.disableRevalidate) return doc
  const paths = new Set<string>()
  if (doc._status === 'published' && doc.slug) paths.add(`/case-studies/${doc.slug}`)
  if (previousDoc?._status === 'published' && previousDoc.slug) paths.add(`/case-studies/${previousDoc.slug}`)
  for (const path of paths) revalidatePath(path)
  revalidateTag('case-studies', 'max')
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate && doc?.slug) revalidatePath(`/case-studies/${doc.slug}`)
  if (!context.disableRevalidate) revalidateTag('case-studies', 'max')
  return doc
}
