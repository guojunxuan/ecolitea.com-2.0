import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { createRevalidation } from '@/plugins/translation/revalidate'
import type { Product } from '@/payload-types'
import { productCategoryPath, productPath } from '@/utilities/products/paths'
import { clearProductPublicTransition, getProductPublicTransition } from './productPublicTransition'
import { consumeProductTranslation, getTranslationRuntime } from '@/plugins/translation/hooks'

const relationshipID = (value: Product['category']) =>
  typeof value === 'object' ? value?.id : value

export const invalidateProducts = (docs: Product[]) => {
  const cache = createRevalidation()
  const { revalidatePath, revalidateTag } = cache
  const paths = new Set<string>()
  const tags = new Set(['products-list', 'products-overview', 'products-sitemap'])
  for (const doc of docs) {
    if (doc.slug && doc.categorySlug) paths.add(productPath(doc.categorySlug, doc.slug))
    if (doc.categorySlug) paths.add(productCategoryPath(doc.categorySlug))
    if (doc.id) tags.add(`product-${doc.id}`)
    const categoryID = relationshipID(doc.category)
    if (categoryID) tags.add(`product-category-${categoryID}`)
  }
  for (const path of paths) revalidatePath(path)
  for (const tag of tags) revalidateTag(tag, 'max')
  return cache.flush()
}

export const revalidateProduct: CollectionAfterChangeHook<Product> = async ({
  doc,
  previousDoc,
  req,
}) => {
  const cache = createRevalidation()
  const { revalidateTag } = cache
  try {
    const translation = getTranslationRuntime(req)
    const transition =
      !req.context.disableRevalidate || translation
        ? await getProductPublicTransition(req, doc, previousDoc)
        : undefined
    if (translation && transition)
      await consumeProductTranslation(req, doc, transition, translation)
    if (!req.context.disableRevalidate) {
      const { before, after } = transition!
      const publicKeys = ['_status', 'slug', 'categorySlug', 'publishedAt', 'updatedAt'] as const
      const changed = publicKeys.some((key) => before?.[key] !== after?.[key])
      if (changed) {
        const published = [before, after].filter((item): item is Product => Boolean(item))
        if (published.length) await invalidateProducts(published)
        const oldPath =
          before?.slug && before.categorySlug ? productPath(before.categorySlug, before.slug) : null
        const newPath =
          after?.slug && after.categorySlug ? productPath(after.categorySlug, after.slug) : null
        if (oldPath !== newPath || Boolean(before) !== Boolean(after))
          revalidateTag('redirects', { expire: 0 })
      }
    }
    await cache.flush()
  } finally {
    clearProductPublicTransition(req, doc.id)
  }
  return doc
}

export const revalidateProductDelete: CollectionAfterDeleteHook<Product> = async ({ doc, req }) => {
  const cache = createRevalidation()
  const { revalidateTag } = cache
  try {
    if (!req.context.disableRevalidate) {
      const { before } = await getProductPublicTransition(req, doc, doc)
      if (before) {
        await invalidateProducts([before])
        revalidateTag('redirects', { expire: 0 })
      }
    }
    await cache.flush()
  } finally {
    clearProductPublicTransition(req, doc.id)
  }
  return doc
}
