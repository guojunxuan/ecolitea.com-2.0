import { allCategories, allProducts, cached, toProductCategory } from './shared'

export const getProductCategoriesOverview = () =>
  cached(
    ['products-overview'],
    ['products-overview', 'product-categories', 'products-list'],
    async () => {
      const [categories, products] = await Promise.all([allCategories(), allProducts()])
      return categories.flatMap((category) => {
        const productCount = products.filter(
          (product) =>
            (typeof product.category === 'string' ? product.category : product.category?.id) ===
            category.id,
        ).length
        if (!productCount) return []
        const { meta: _meta, ...model } = toProductCategory(category)
        return [{ ...model, productCount }]
      })
    },
  )
