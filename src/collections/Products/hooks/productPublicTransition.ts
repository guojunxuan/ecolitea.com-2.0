import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook, PayloadRequest } from 'payload'
import type { Product } from '@/payload-types'

type PublicTransition = { id: string | null; before: Product | null; after?: Product | null }
const transitions = new WeakMap<PayloadRequest, PublicTransition>()

export const captureProductPublicState: CollectionBeforeChangeHook<Product> = async ({ data, originalDoc, req }) => {
  const before = originalDoc?.id
    ? await req.payload.findByID({ collection: 'products', id: originalDoc.id, draft: false, depth: 0, req, disableErrors: true })
    : null
  transitions.set(req, { id: originalDoc?.id ?? null, before: before?._status === 'published' ? before : null })
  return data
}

export const captureProductPublicBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const before = await req.payload.findByID({ collection: 'products', id, draft: false, depth: 0, req, disableErrors: true })
  transitions.set(req, { id: String(id), before: before?._status === 'published' ? before : null })
}

export const getProductPublicTransition = async (
  req: PayloadRequest,
  doc: Product,
  previousDoc?: Product | null,
): Promise<{ before: Product | null; after: Product | null }> => {
  const transition = transitions.get(req)
  if (!transition || (transition.id && transition.id !== doc.id)) {
    // Allows isolated hook callers to supply the same effective transition.
    return {
      before: previousDoc?._status === 'published' ? previousDoc : null,
      after: doc._status === 'published' ? doc : null,
    }
  }
  if (transition.after === undefined) {
    const current = await req.payload.findByID({ collection: 'products', id: doc.id, draft: false, depth: 0, req, disableErrors: true })
    transition.after = current?._status === 'published' ? current : null
  }
  return { before: transition.before, after: transition.after }
}
