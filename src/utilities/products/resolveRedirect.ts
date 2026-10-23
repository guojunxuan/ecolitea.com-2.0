import type { Payload } from 'payload'
import type { Redirect } from '@/payload-types'
import { getContentPath } from '@/utilities/getContentPath'
import { publicProductVisibility } from './publicVisibility'

// Resolve stable IDs on every request; populated redirect relationships can be stale.
// Never inherit an authenticated request when deciding a public redirect destination.
export async function resolveProductRedirect(
  payload: Payload,
  reference: NonNullable<NonNullable<Redirect['to']>['reference']>,
) {
  const collection = reference.relationTo
  if (collection !== 'products' && collection !== 'product-categories') return null
  const id = typeof reference.value === 'object' ? reference.value?.id : reference.value
  if (!id) return null
  const document = await payload.findByID({
    collection,
    id,
    depth: 0,
    draft: false,
    overrideAccess: false,
    disableErrors: true,
  })
  if (!document?.slug) return null
  if (collection === 'products') {
    if (
      !('categorySlug' in document) ||
      document._status !== 'published' ||
      !document.publishedAt ||
      !(Date.parse(document.publishedAt) <= Date.now())
    )
      return null
    return getContentPath(collection, document.slug, { categorySlug: document.categorySlug })
  }
  const visible = await payload.find({
    collection: 'products',
    depth: 0,
    draft: false,
    overrideAccess: false,
    limit: 1,
    where: { and: [{ category: { equals: id } }, publicProductVisibility(new Date())] },
  })
  return visible.docs.length ? getContentPath(collection, document.slug) : null
}
