import type { Product } from '@/payload-types'
import type { ProductCategoryOverview } from './models'
import { allCategories, allProducts, cached, toProductCard, toProductCategory } from './shared'

export const getProductCategoriesOverview = (): Promise<ProductCategoryOverview[]> =>
  cached(
    ['products-overview-v2'],
    ['products-overview', 'product-categories', 'products-list'],
    async () => {
      const [categories, products] = await Promise.all([allCategories(), allProducts()])
      const byCategory = new Map<string, Product[]>()
      for (const product of products) {
        const categoryID =
          typeof product.category === 'string' ? product.category : product.category?.id
        if (!categoryID) continue
        const grouped = byCategory.get(categoryID) ?? []
        grouped.push(product)
        byCategory.set(categoryID, grouped)
      }
      return categories.flatMap((category) => {
        const grouped = byCategory.get(category.id) ?? []
        const productCount = grouped.length
        if (!productCount) return []
        const { meta: _meta, ...model } = toProductCategory(category)
        return [
          {
            ...model,
            productCount,
            products: grouped.slice(0, 4).map(toProductCard),
            imageFit:
              model.image?.width &&
              model.image.height &&
              model.image.width / model.image.height <= 1.3
                ? 'contain'
                : 'cover',
          },
        ]
      })
    },
  )
