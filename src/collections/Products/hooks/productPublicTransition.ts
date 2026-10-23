import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload'
import type { Product } from '@/payload-types'

type PublicTransition = { before: Product | null; after?: Product | null }
const stateKey = Symbol('productPublicTransitions')
type TransitionContainer = { [stateKey]: Map<string, PublicTransition> }

const getTransitions = (req: PayloadRequest, create = false) => {
  const container = req.context.productPublicTransitions as TransitionContainer | undefined
  if (container?.[stateKey] instanceof Map) return container[stateKey]
  if (!create) return undefined
  const transitions = new Map<string, PublicTransition>()
  // A string-keyed context value survives createLocalReq's empty-context check
  // and spreads; the private Symbol keeps its contents server-owned. The value
  // also survives restoreVersion's request Proxy and concurrent bulk hooks.
  req.context.productPublicTransitions = { [stateKey]: transitions }
  return transitions
}

const capture = async (req: PayloadRequest, id: string) => {
  // Initialize before awaiting: every bulk document must share this container.
  const transitions = getTransitions(req, true)!
  // A retry on the same request must never reuse an interrupted write's state.
  transitions.delete(id)
  const before = await req.payload.findByID({
    collection: 'products',
    id,
    draft: false,
    depth: 0,
    req,
    disableErrors: true,
  })
  transitions.set(id, { before: before?._status === 'published' ? before : null })
}

export const captureProductPublicState: CollectionBeforeChangeHook<Product> = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  // Creates have no prior public record, including duplicated documents.
  if (operation === 'update' && data._status === 'draft' && originalDoc?.id) {
    // Replace any interrupted capture and mark this document unchanged so after
    // hooks cannot fall back to reading its public record during a draft save.
    getTransitions(req, true)!.set(originalDoc.id, { before: null, after: null })
  } else if (operation !== 'create' && originalDoc?.id) await capture(req, originalDoc.id)
  return data
}

export const captureProductPublicBeforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await capture(req, String(id))
}

export const clearProductPublicTransition = (req: PayloadRequest, id: string) => {
  // Keep the empty container stable across context copies; release each document
  // after the last consumer, including writes with revalidation disabled.
  getTransitions(req)?.delete(id)
}

export const getProductPublicTransition = async (
  req: PayloadRequest,
  doc: Product,
  previousDoc?: Product | null,
): Promise<{ before: Product | null; after: Product | null }> => {
  const transition = getTransitions(req)?.get(doc.id)
  if (!transition) {
    // Creates and isolated hook callers have no captured public snapshot.
    return {
      before: previousDoc?._status === 'published' ? previousDoc : null,
      after: doc._status === 'published' ? doc : null,
    }
  }
  if (transition.after === undefined) {
    const current = await req.payload.findByID({
      collection: 'products',
      id: doc.id,
      draft: false,
      depth: 0,
      req,
      disableErrors: true,
    })
    transition.after = current?._status === 'published' ? current : null
  }
  return { before: transition.before, after: transition.after }
}
