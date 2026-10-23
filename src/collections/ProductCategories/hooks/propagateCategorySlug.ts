import type { CollectionAfterChangeHook } from 'payload'
import { revalidateTag } from 'next/cache'
import type { Product, ProductCategory } from '@/payload-types'
import { productPath } from '@/utilities/products/paths'
import { productCategoryPath } from '@/utilities/products/paths'
import { upsertRedirect } from '@/collections/Products/hooks/productRedirects'
import { invalidateProducts } from '@/collections/Products/hooks/revalidateProduct'

const categoryRedirectPaths = (oldSlug: string, newSlug: string) => ({
  from: productCategoryPath(oldSlug),
  to: productCategoryPath(newSlug),
})

const PAGE_SIZE = 100
const categoryID = (value: Product['category']) => (typeof value === 'object' ? value?.id : value)

export const propagateCategorySlug: CollectionAfterChangeHook<ProductCategory> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (!doc.slug) return doc
  if (!previousDoc?.slug || previousDoc.slug === doc.slug) {
    // A once-redirected path may become a live category on creation or edit.
    await upsertRedirect(
      req,
      null,
      { relationTo: 'product-categories', id: doc.id },
      categoryRedirectPaths(doc.slug, doc.slug).to,
    )
    return doc
  }

  // A public record and its latest draft may belong to different categories.
  // Snapshot the union before writes so pagination cannot skip a moved record.
  const productIDs = new Set<string>()
  for (const draft of [false, true]) {
    let page = 1
    while (true) {
      const result = await req.payload.find({
        collection: 'products',
        where: { category: { equals: doc.id } },
        draft,
        depth: 0,
        limit: PAGE_SIZE,
        page,
        sort: 'id',
        req,
      })
      for (const product of result.docs) productIDs.add(String(product.id))
      if (!result.hasNextPage) break
      page++
    }
  }

  // createLocalReq merges context back onto this SAME req. Restore it after
  // each nested write, keeping the request and transaction identity intact.
  const updateProduct = async (options: {
    collection: 'products'
    id: string
    data: Partial<Product>
    draft: boolean
    depth: 0
    req: typeof req
  }) => {
    const originalContext = req.context
    try {
      return await req.payload.update({
        ...options,
        req,
        context: {
          ...originalContext,
          disableRevalidate: true,
          skipProductRedirect: true,
          setDerivedCategorySlug: true,
        },
      })
    } finally {
      req.context = originalContext
    }
  }
  const affectedPublished: Product[] = []
  const affectedDraftIDs = new Set<string>()
  for (const id of productIDs) {
    // A published record may have a newer draft. Patch the public record first,
    // then patch the draft version independently so neither loses its other fields.
    const published = await req.payload.findByID({
      collection: 'products',
      id,
      draft: false,
      depth: 0,
      req,
      disableErrors: true,
    })
    const latest = await req.payload.findByID({
      collection: 'products',
      id,
      draft: true,
      depth: 0,
      req,
      disableErrors: true,
    })
    const publicMatches =
      published?._status === 'published' && categoryID(published.category) === doc.id
    const draftMatches = latest?._status === 'draft' && categoryID(latest.category) === doc.id
    if (publicMatches && published) {
      affectedPublished.push(published)
      // Payload updateByID loads the latest version even for draft:false.
      // Supply the complete public snapshot so private draft fields are not
      // inadvertently copied into the published record.
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...publicData } = published
      await updateProduct({
        collection: 'products',
        id,
        data: { ...publicData, categorySlug: doc.slug, _status: 'published' },
        draft: false,
        depth: 0,
        req,
      })
      if (published.slug)
        await upsertRedirect(
          req,
          productPath(previousDoc.slug, published.slug),
          { relationTo: 'products', id },
          productPath(doc.slug, published.slug),
        )
    }
    if ((publicMatches || draftMatches) && latest?._status === 'draft') {
      // The public update writes a newer version. Restore the previously read
      // draft's complete content, changing its slug only if it belongs here.
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draftData } = latest
      await updateProduct({
        collection: 'products',
        id,
        data: {
          ...draftData,
          categorySlug: draftMatches ? doc.slug : latest.categorySlug,
          _status: 'draft',
        },
        draft: true,
        depth: 0,
        req,
      })
      if (draftMatches) affectedDraftIDs.add(id)
    }
  }

  const paths = categoryRedirectPaths(previousDoc.slug, doc.slug)
  await upsertRedirect(req, paths.from, { relationTo: 'product-categories', id: doc.id }, paths.to)
  if (!req.context.disableRevalidate) {
    // Stable ID detail caches must refresh after their derived category slug changes.
    invalidateProducts([
      ...affectedPublished,
      ...affectedPublished.map((product) => ({ ...product, categorySlug: doc.slug })),
    ])
    const publishedIDs = new Set(affectedPublished.map((product) => String(product.id)))
    for (const id of affectedDraftIDs) {
      if (!publishedIDs.has(id)) revalidateTag(`product-${id}`, 'max')
    }
  }
  return doc
}
