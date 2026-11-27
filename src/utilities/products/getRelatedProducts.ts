import { getLocalizedList } from '../i18n/getLocalized'
import type { Product } from '@/payload-types'
import type { ProductDetail } from './models'
import { cached, client, toProductCard, visible } from './shared'

export const getRelatedProducts = (product: ProductDetail, locale = 'en') =>
  cached(
    [
      'product-related', locale,
      product.id,
      product.category?.id ?? '',
      JSON.stringify(product.relatedProducts),
    ],
    [
      'products-list', `translations:${locale}`,
      `product-${product.id}`,
      ...(product.category ? [`product-category-${product.category.id}`] : []),
    ],
    async () => {
      const payload = await client()
      const ids = [...new Set(product.relatedProducts)].filter((id) => id !== product.id)
      const selected: Product[] = []
      if (ids.length) {
        const result = await payload.find({
          collection: 'products',
          depth: 1,
          draft: false,
          overrideAccess: false,
          pagination: false,
          limit: ids.length,
          where: visible([{ id: { in: ids } }, { id: { not_in: [product.id] } }]),
        })
        const byId = new Map(result.docs.map((doc) => [doc.id, doc]))
        for (const id of ids) {
          const doc = byId.get(id)
          if (doc && selected.length < 8) selected.push(doc)
        }
      }
      if (selected.length < 8 && product.category) {
        const result = await payload.find({
          collection: 'products',
          depth: 1,
          draft: false,
          overrideAccess: false,
          limit: 8 - selected.length,
          sort: '-publishedAt',
          where: visible([
            { category: { equals: product.category.id } },
            { id: { not_in: [product.id, ...selected.map((doc) => doc.id)] } },
          ]),
        })
        for (const doc of result.docs)
          if (
            doc.id !== product.id &&
            !selected.some((item) => item.id === doc.id) &&
            selected.length < 8
          )
            selected.push(doc)
      }
      return (await getLocalizedList(selected, 'products', locale, payload)).map(toProductCard)
    },
  )
