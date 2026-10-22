import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import type { Product, Redirect } from '@/payload-types'
import { productCategoryPath, productPath } from '@/utilities/products/paths'

type Target = { relationTo: 'products' | 'product-categories'; id: string | number }

export const clearOccupiedRedirect = async (req: PayloadRequest, path: string) => {
  const existing = await req.payload.find({
    collection: 'redirects', where: { from: { equals: path } }, limit: 1, depth: 0, req,
  })
  for (const item of existing.docs) await req.payload.delete({ collection: 'redirects', id: item.id, req })
}

export const upsertRedirect = async (req: PayloadRequest, fromPath: string | null, toPath: string, to: Target) => {
  await clearOccupiedRedirect(req, toPath)
  if (!fromPath || fromPath === toPath) return
  const existing = await req.payload.find({
    collection: 'redirects', where: { from: { equals: fromPath } }, limit: 1, depth: 0, req,
  })
  const reference: NonNullable<NonNullable<Redirect['to']>['reference']> = to.relationTo === 'products'
    ? { relationTo: 'products', value: String(to.id) }
    : { relationTo: 'product-categories', value: String(to.id) }
  const data = { to: { type: 'reference' as const, reference }, type: '301' as const }
  if (existing.docs[0]) await req.payload.update({ collection: 'redirects', id: existing.docs[0].id, data, req })
  else await req.payload.create({ collection: 'redirects', data: { from: fromPath, ...data }, req })
}

export const redirectProduct: CollectionAfterChangeHook<Product> = async ({ doc, previousDoc, req }) => {
  if (req.context.skipProductRedirect || doc._status !== 'published') return doc
  if (!doc.slug || !doc.categorySlug) return doc
  const toPath = productPath(doc.categorySlug, doc.slug)
  const fromPath = previousDoc?._status === 'published' && previousDoc.slug && previousDoc.categorySlug
    ? productPath(previousDoc.categorySlug, previousDoc.slug) : null
  await upsertRedirect(req, fromPath, toPath, { relationTo: 'products', id: doc.id })
  return doc
}

export const categoryRedirectPaths = (oldSlug: string, newSlug: string) => ({
  from: productCategoryPath(oldSlug), to: productCategoryPath(newSlug),
})
