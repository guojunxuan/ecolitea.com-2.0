import { allCategories, allProducts, cached } from './shared'

export const getProductStaticParams = () =>
  cached(
    ['products-static-params'],
    ['products-sitemap', 'products-list', 'product-categories'],
    async () => {
      const [categories, products] = await Promise.all([allCategories(), allProducts()])
      const active = categories.filter((category) =>
        products.some(
          (product) =>
            (typeof product.category === 'string' ? product.category : product.category?.id) ===
            category.id,
        ),
      )
      const slugs = new Set(active.map((category) => category.slug))
      return {
        categories: active.map((category) => category.slug),
        products: products.flatMap((product) =>
          product.categorySlug && slugs.has(product.categorySlug)
            ? [{ category: product.categorySlug, product: product.slug }]
            : [],
        ),
      }
    },
  )
