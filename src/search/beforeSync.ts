import type { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

export const beforeSyncWithSearch: BeforeSync = async ({ req, originalDoc, searchDoc }) => {
  const collection = searchDoc.doc.relationTo
  const { slug, id, title, meta } = originalDoc

  if (collection === 'blogs') {
    const category = originalDoc.category
    const categoryDoc = category && typeof category === 'object'
      ? category
      : category
        ? await req.payload.findByID({
            collection: 'blog-categories',
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
      excerpt: originalDoc.excerpt,
      heroImage: originalDoc.heroImage?.id || originalDoc.heroImage,
      publishedAt: originalDoc.publishedAt,
      category: categoryDoc
        ? {
            relationTo: 'blog-categories',
            categoryID: String(categoryDoc.id),
            title: categoryDoc.title,
            slug: categoryDoc.slug,
          }
        : null,
      meta: {
        title: meta?.title || title,
        description: meta?.description || originalDoc.excerpt,
        image: meta?.image?.id || meta?.image || originalDoc.heroImage?.id || originalDoc.heroImage,
      },
    }
  }

  const modifiedDoc: DocToSync = {
    ...searchDoc,
    slug,
    meta: {
      title: meta?.title || title,
      image: meta?.image?.id || meta?.image,
      description: meta?.description,
    },
    categories: [],
  }

  const categories = originalDoc.categories
  if (categories && Array.isArray(categories) && categories.length > 0) {
    const populatedCategories: { id: string | number; title: string }[] = []
    for (const category of categories) {
      if (!category) {
        continue
      }

      if (typeof category === 'object') {
        populatedCategories.push(category)
        continue
      }

      const doc = await req.payload.findByID({
        collection: 'categories',
        id: category,
        disableErrors: true,
        depth: 0,
        select: { title: true },
        req,
      })

      if (doc !== null) {
        populatedCategories.push(doc)
      } else {
        console.error(
          `Failed. Category not found when syncing collection '${collection}' with id: '${id}' to search.`,
        )
      }
    }

    modifiedDoc.categories = populatedCategories.map((each) => ({
      relationTo: 'categories',
      categoryID: String(each.id),
      title: each.title,
    }))
  }

  return modifiedDoc
}
