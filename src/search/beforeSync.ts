import type { BeforeSync } from '@payloadcms/plugin-search/types'

export const beforeSyncWithSearch: BeforeSync = async ({ req, originalDoc, searchDoc }) => {
  const collection = searchDoc.doc.relationTo
  const { slug, title, meta } = originalDoc

  if (collection !== 'blogs' && collection !== 'products') return searchDoc

  const isProduct = collection === 'products'
  const categoryCollection = isProduct ? 'product-categories' : 'blog-categories'
  const excerpt = isProduct ? originalDoc.summary : originalDoc.excerpt
  const cover = isProduct ? originalDoc.gallery?.[0] : originalDoc.heroImage
  const category = originalDoc.category
  const categoryDoc =
    category && typeof category === 'object'
      ? category
      : category
        ? await req.payload.findByID({
            collection: categoryCollection,
            id: category,
            disableErrors: true,
            depth: 0,
            select: { title: true, slug: true },
            req,
          })
        : null

  return {
    ...searchDoc,
    slug,
    ...(isProduct ? { categorySlug: originalDoc.categorySlug } : {}),
    excerpt,
    heroImage: cover?.id || cover,
    publishedAt: originalDoc.publishedAt,
    category: categoryDoc
      ? {
          relationTo: categoryCollection,
          categoryID: String(categoryDoc.id),
          title: categoryDoc.title,
          slug: categoryDoc.slug,
        }
      : null,
    meta: {
      title: meta?.title || title,
      description: meta?.description || excerpt,
      image: meta?.image?.id || meta?.image || cover?.id || cover,
    },
  }
}
