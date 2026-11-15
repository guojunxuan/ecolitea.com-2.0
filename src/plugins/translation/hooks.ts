import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload'
import type { Product } from '@/payload-types'
import { isLegalPage, type SourceDocument, type TranslationRuntime } from './task'

// Public config.custom carries a function, not enumerable provider credentials.
// Removing the plugin registration makes existing Product consumers a no-op.
export function getTranslationRuntime(req: PayloadRequest): TranslationRuntime | undefined {
  const resolve = req.payload?.config?.custom?.translationRuntime
  return typeof resolve === 'function' ? (resolve() as TranslationRuntime) : undefined
}

const stateKey = 'translationPublicBefore'
const publicBefore = (req: PayloadRequest): Map<string, boolean> => {
  if (!(req.context[stateKey] instanceof Map)) req.context[stateKey] = new Map<string, boolean>()
  return req.context[stateKey] as Map<string, boolean>
}

async function completeDoc(
  req: PayloadRequest,
  source: string,
  doc: SourceDocument,
  drafts: boolean,
) {
  if (doc.updatedAt && (!drafts || doc._status)) return doc
  return (await req.payload.findByID({
    collection: source as 'pages',
    id: String(doc.id),
    depth: 0,
    draft: true,
    req,
  })) as unknown as SourceDocument
}

async function publish(
  req: PayloadRequest,
  source: string,
  doc: SourceDocument,
  runtime: TranslationRuntime,
): Promise<void> {
  if (!runtime.canQueue || !doc.updatedAt) return
  const id = source.startsWith('global:') ? source.slice(7) : String(doc.id)
  if (source === 'pages' && (await isLegalPage(req, id))) return
  for (const locale of runtime.targets)
    await runtime.queue(req, {
      sourceCollection: source,
      sourceId: id,
      locale,
      sourceVersion: doc.updatedAt,
    })
}

export function createCollectionTranslationHooks(
  source: string,
  drafts: boolean,
  runtime: TranslationRuntime,
) {
  const beforeChange: CollectionBeforeChangeHook = async ({
    req,
    originalDoc,
    operation,
    data,
  }) => {
    if (req.context.translationWrite || !drafts || operation === 'create' || !originalDoc?.id)
      return data
    const map = publicBefore(req)
    const key = `${source}:${originalDoc.id}`
    map.delete(key)
    const prior = await req.payload.findByID({
      collection: source as 'pages',
      id: originalDoc.id,
      draft: false,
      depth: 0,
      disableErrors: true,
      req,
    })
    map.set(key, prior?._status === 'published')
    return data
  }
  const afterChange: CollectionAfterChangeHook = async ({ req, doc }) => {
    if (req.context.translationWrite) return doc
    const key = `${source}:${doc.id}`
    try {
      const changed = await completeDoc(req, source, doc, drafts)
      if (!drafts || changed._status === 'published') await publish(req, source, changed, runtime)
      else if (publicBefore(req).get(key)) {
        const current = await req.payload.findByID({
          collection: source as 'pages',
          id: doc.id,
          draft: false,
          depth: 0,
          disableErrors: true,
          req,
        })
        if (current?._status !== 'published') await runtime.cleanup(req, source, String(doc.id))
      }
    } finally {
      publicBefore(req).delete(key)
    }
    return doc
  }
  const afterDelete: CollectionAfterDeleteHook = async ({ req, doc, id }) => {
    if (!req.context.translationWrite) await runtime.cleanup(req, source, String(id ?? doc.id))
    return doc
  }
  return { beforeChange, afterChange, afterDelete }
}

export function createGlobalTranslationHook(
  source: string,
  runtime: TranslationRuntime,
): GlobalAfterChangeHook {
  return async ({ doc, req }) => {
    if (req.context.translationWrite) return doc
    // A caller can project out the legal fields while keeping updatedAt. Always
    // restore this Global before making legal classification decisions.
    const changed =
      source === 'global:site-settings' || !doc.updatedAt
        ? await req.payload.findGlobal({ slug: source.slice(7) as 'site-settings', depth: 0, req })
        : doc
    // Reclassifying an existing Page as legal must also remove previously ready
    // translations, even if queueing is disabled. Only plugin-owned rows change.
    if (source === 'global:site-settings') {
      for (const value of [
        changed.privacyPolicyPage,
        changed.cookiePolicyPage,
        changed.termsPage,
      ]) {
        const id = value && typeof value === 'object' ? value.id : value
        if (typeof id === 'string' || typeof id === 'number')
          await runtime.cleanup(req, 'pages', String(id))
      }
    }
    await publish(req, source, changed, runtime)
    return doc
  }
}

/** Called by the Products transition's final consumer, before it releases state. */
export async function consumeProductTranslation(
  req: PayloadRequest,
  doc: Product,
  transition: { before: Product | null; after: Product | null },
  runtime: TranslationRuntime,
): Promise<void> {
  if (req.context.translationWrite) return
  if (transition.before && !transition.after) await runtime.cleanup(req, 'products', doc.id)
  const changed = await completeDoc(req, 'products', doc as unknown as SourceDocument, true)
  if (changed._status === 'published') await publish(req, 'products', changed, runtime)
}
