import { readySourceIDs } from '@/utilities/i18n/seo'
import { allCategories, allProducts, cached, client } from './shared'

export const getProductStaticParams = (locale = 'en') =>
  cached(
    ['products-static-params', locale],
    ['products-sitemap', 'products-list', 'product-categories', `translations:${locale}`],
    async () => {
      let [categories, products] = await Promise.all([allCategories(), allProducts()])
      if (locale !== 'en') {
        const payload = await client()
        const [readyCategories, readyProducts] = await Promise.all([
          readySourceIDs(
            payload,
            'product-categories',
            categories.map(({ id }) => id),
            locale,
          ),
          readySourceIDs(
            payload,
            'products',
            products.map(({ id }) => id),
            locale,
          ),
        ])
        categories = categories.filter(({ id }) => readyCategories.has(id))
        products = products.filter(({ id }) => readyProducts.has(id))
      }
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
