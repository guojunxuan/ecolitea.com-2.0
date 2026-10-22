import type { CollectionAfterChangeHook } from 'payload'
import { revalidateTag } from 'next/cache'
import type { Product, ProductCategory } from '@/payload-types'
import { productPath } from '@/utilities/products/paths'
import { upsertRedirect, categoryRedirectPaths } from './productRedirects'
import { invalidateProducts } from './revalidateProduct'

const PAGE_SIZE = 100

export const propagateCategorySlug: CollectionAfterChangeHook<ProductCategory> = async ({ doc, previousDoc, req }) => {
  if (!doc.slug) return doc
  if (!previousDoc?.slug || previousDoc.slug === doc.slug) {
    // A once-redirected path may become a live category on creation or edit.
    await upsertRedirect(req, null, categoryRedirectPaths(doc.slug, doc.slug).to, { relationTo: 'product-categories', id: doc.id })
    return doc
  }

  // Snapshot IDs before changing any records: a query against the old slug would
  // otherwise shrink while advancing through its pages.
  const products: Product[] = []
  let page = 1
  while (true) {
    const result = await req.payload.find({
      collection: 'products', where: { category: { equals: doc.id } },
      draft: true, depth: 0, limit: PAGE_SIZE, page, sort: 'id', req,
    })
    products.push(...result.docs)
    if (!result.hasNextPage) break
    page++
  }

  const context = { ...req.context, disableRevalidate: true, skipProductRedirect: true, setDerivedCategorySlug: true }
  const affectedPublished: Product[] = []
  for (const product of products) {
    // A published record may have a newer draft. Patch the public record first,
    // then patch the draft version independently so neither loses its other fields.
    const published = await req.payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0, req, disableErrors: true })
    if (published?._status === 'published') {
      affectedPublished.push(published)
      // Payload updateByID loads the latest version even for draft:false.
      // Supply the complete public snapshot so private draft fields are not
      // inadvertently copied into the published record.
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...publicData } = published
      await req.payload.update({ collection: 'products', id: product.id, data: { ...publicData, categorySlug: doc.slug, _status: 'published' }, draft: false, depth: 0, req, context })
      if (published.slug) await upsertRedirect(req, productPath(previousDoc.slug, published.slug), productPath(doc.slug, published.slug), { relationTo: 'products', id: product.id })
    }
    if (product._status === 'draft') {
      // The public update writes a newer version. Restore the previously read
      // draft's complete content while changing only its derived category slug.
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draftData } = product
      await req.payload.update({ collection: 'products', id: product.id, data: { ...draftData, categorySlug: doc.slug, _status: 'draft' }, draft: true, depth: 0, req, context })
    }
  }

  const paths = categoryRedirectPaths(previousDoc.slug, doc.slug)
  await upsertRedirect(req, paths.from, paths.to, { relationTo: 'product-categories', id: doc.id })
  if (!req.context.disableRevalidate) {
    // Stable ID detail caches must refresh after their derived category slug changes.
    invalidateProducts([
      ...affectedPublished,
      ...affectedPublished.map((product) => ({ ...product, categorySlug: doc.slug })),
    ])
    const publishedIDs = new Set(affectedPublished.map((product) => String(product.id)))
    for (const product of products) {
      if (!publishedIDs.has(String(product.id))) revalidateTag(`product-${product.id}`, 'max')
    }
  }
  return doc
}
