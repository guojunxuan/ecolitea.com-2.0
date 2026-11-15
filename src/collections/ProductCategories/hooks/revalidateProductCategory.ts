import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { revalidateLocalizedPath as revalidatePath } from '@/utilities/i18n/revalidatePaths'
import type { ProductCategory } from '@/payload-types'
import { productCategoryPath, productsOverviewPath } from '@/utilities/products/paths'

export const invalidateProductCategory = (docs: ProductCategory[]) => {
  const paths = new Set([productsOverviewPath])
  for (const doc of docs) if (doc?.slug) paths.add(productCategoryPath(doc.slug))
  for (const path of paths) revalidatePath(path)
  for (const tag of [
    'product-categories',
    'products-overview',
    'products-list',
    'products-sitemap',
  ])
    revalidateTag(tag, 'max')
}

export const revalidateProductCategory: CollectionAfterChangeHook<ProductCategory> = ({
  doc,
  previousDoc,
  req,
}) => {
  if (!req.context.disableRevalidate) {
    invalidateProductCategory(
      [previousDoc, doc].filter((item): item is ProductCategory => Boolean(item)),
    )
    if (previousDoc?.slug !== doc.slug) revalidateTag('redirects', { expire: 0 })
  }
  return doc
}
export const revalidateProductCategoryDelete: CollectionAfterDeleteHook<ProductCategory> = ({
  doc,
  req,
}) => {
  if (!req.context.disableRevalidate) invalidateProductCategory([doc])
  return doc
}
