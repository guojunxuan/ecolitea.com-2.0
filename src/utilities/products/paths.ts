export const productsOverviewPath = '/products'

export const productCategoryPath = (slug: string, page = 1) =>
  `/products/${encodeURIComponent(slug)}${page > 1 ? `/page/${page}` : ''}`

export const productPath = (categorySlug: string, slug: string) =>
  `${productCategoryPath(categorySlug)}/${encodeURIComponent(slug)}`
