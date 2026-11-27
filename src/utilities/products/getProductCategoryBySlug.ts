import { getLocalizedDoc } from '../i18n/getLocalized'
import { cached, client, toProductCategory, visible } from './shared'

export const getProductCategoryBySlug = (slug: string, locale = 'en') =>
  cached(['product-category', slug, locale], ['product-categories', 'products-list', `translations:${locale}`], async () => {
    const payload = await client()
    const result = await payload.find({
      collection: 'product-categories',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    const category = await getLocalizedDoc(result.docs[0], 'product-categories', locale, payload)
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
