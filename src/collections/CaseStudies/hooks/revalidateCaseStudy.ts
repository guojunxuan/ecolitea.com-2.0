import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { createRevalidation } from '@/plugins/translation/revalidate'

export const revalidateCaseStudy: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req: { payload, context },
}) => {
  if (context.disableRevalidate) return doc
  const cache = createRevalidation()
  const { revalidatePath, revalidateTag } = cache
  const paths = new Set<string>()
  if (doc._status === 'published' && doc.slug) paths.add(`/case-studies/${doc.slug}`)
  if (previousDoc?._status === 'published' && previousDoc.slug)
    paths.add(`/case-studies/${previousDoc.slug}`)
  for (const path of paths) revalidatePath(path)
  revalidateTag('case-studies', 'max')
  await cache.flush()
  return doc
}

export const revalidateDelete: CollectionAfterDeleteHook = async ({ doc, req: { context } }) => {
  const cache = createRevalidation()
  const { revalidatePath, revalidateTag } = cache
  if (!context.disableRevalidate && doc?.slug) revalidatePath(`/case-studies/${doc.slug}`)
  if (!context.disableRevalidate) revalidateTag('case-studies', 'max')
  await cache.flush()
  return doc
}
