import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Product } from '@/payload-types'
import { productCategoryPath, productPath } from '@/utilities/products/paths'

const relationshipID = (value: Product['category']) => typeof value === 'object' ? value?.id : value

export const invalidateProducts = (docs: Product[]) => {
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
}

export const revalidateProduct: CollectionAfterChangeHook<Product> = ({ doc, previousDoc, req }) => {
  if (!req.context.disableRevalidate) {
    const published = [previousDoc, doc].filter((item): item is Product => item?._status === 'published')
    if (published.length) {
      invalidateProducts(published)
      const oldPath = previousDoc?.slug && previousDoc.categorySlug ? productPath(previousDoc.categorySlug, previousDoc.slug) : null
      const newPath = doc.slug && doc.categorySlug ? productPath(doc.categorySlug, doc.slug) : null
      if (oldPath !== newPath || previousDoc?._status !== doc._status) revalidateTag('redirects', { expire: 0 })
    }
  }
  return doc
}

export const revalidateProductDelete: CollectionAfterDeleteHook<Product> = ({ doc, req }) => {
  if (!req.context.disableRevalidate && doc._status === 'published') invalidateProducts([doc])
  return doc
}
