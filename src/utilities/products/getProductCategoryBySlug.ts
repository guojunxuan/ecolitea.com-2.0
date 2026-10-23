import { cached, client, toProductCategory, visible } from './shared'

export const getProductCategoryBySlug = (slug: string) =>
  cached(['product-category', slug], ['product-categories', 'products-list'], async () => {
    const payload = await client()
    const result = await payload.find({
      collection: 'product-categories',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    const category = result.docs[0]
    if (!category) return null
    const products = await payload.find({
      collection: 'products',
      depth: 0,
      draft: false,
      overrideAccess: false,
      limit: 1,
      where: visible([{ category: { equals: category.id } }]),
    })
    return products.docs.length ? toProductCategory(category) : null
  })
