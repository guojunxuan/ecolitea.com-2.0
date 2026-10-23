import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import type { Product, Redirect } from '@/payload-types'
import { productCategoryPath, productPath } from '@/utilities/products/paths'
import { getProductPublicTransition } from './productPublicTransition'

type Target = { relationTo: 'products' | 'product-categories'; id: string | number }

export const clearOccupiedRedirect = async (req: PayloadRequest, path: string, target: Target) => {
  const existing = await req.payload.find({
    collection: 'redirects',
    where: { from: { equals: path } },
    limit: 1,
    depth: 0,
    req,
  })
  for (const item of existing.docs) {
    const reference = item.to?.type === 'reference' ? item.to.reference : undefined
    const referenceID =
      typeof reference?.value === 'object' ? reference.value?.id : reference?.value
    const selfReference =
      reference?.relationTo === target.relationTo &&
      referenceID != null &&
      String(referenceID) === String(target.id)
    const details = { from: item.from, to: item.to, trigger: target }
    if (selfReference)
      req.payload.logger.debug(details, 'Removing redirect occupying a live product path')
    else req.payload.logger.warn(details, 'Removing redirect occupying a live product path')
    await req.payload.delete({ collection: 'redirects', id: item.id, req })
  }
}

export function upsertRedirect(
  req: PayloadRequest,
  fromPath: string | null,
  to: Target,
): Promise<void>
export function upsertRedirect(
  req: PayloadRequest,
  fromPath: string | null,
  to: Target,
  toPath: string,
): Promise<void>
export async function upsertRedirect(
  req: PayloadRequest,
  fromPath: string | null,
  to: Target,
  knownToPath?: string,
): Promise<void> {
  let toPath = knownToPath
  if (!toPath) {
    const target = await req.payload.findByID({
      collection: to.relationTo,
      id: String(to.id),
      depth: 0,
      draft: false,
      req,
    })
    toPath =
      to.relationTo === 'products'
        ? (target as Product).categorySlug && target.slug
          ? productPath((target as Product).categorySlug!, target.slug)
          : undefined
        : target.slug
          ? productCategoryPath(target.slug)
          : undefined
  }
  if (!toPath) return
  await clearOccupiedRedirect(req, toPath, to)
  if (!fromPath || fromPath === toPath) return
  const existing = await req.payload.find({
    collection: 'redirects',
    where: { from: { equals: fromPath } },
    limit: 1,
    depth: 0,
    req,
  })
  const reference: NonNullable<NonNullable<Redirect['to']>['reference']> =
    to.relationTo === 'products'
      ? { relationTo: 'products', value: String(to.id) }
      : { relationTo: 'product-categories', value: String(to.id) }
  const data = { to: { type: 'reference' as const, reference } }
  if (existing.docs[0])
    await req.payload.update({ collection: 'redirects', id: existing.docs[0].id, data, req })
  else await req.payload.create({ collection: 'redirects', data: { from: fromPath, ...data }, req })
}

export const redirectProduct: CollectionAfterChangeHook<Product> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context.skipProductRedirect) return doc
  const { before, after } = await getProductPublicTransition(req, doc, previousDoc)
  if (!after?.slug || !after.categorySlug) return doc
  const toPath = productPath(after.categorySlug, after.slug)
  const fromPath =
    before?.slug && before.categorySlug ? productPath(before.categorySlug, before.slug) : null
  if (before && after && fromPath === toPath) return doc
  await upsertRedirect(req, fromPath, { relationTo: 'products', id: doc.id }, toPath)
  return doc
}
