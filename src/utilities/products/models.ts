import type { Media, Product, ProductCategory } from '@/payload-types'

export type ProductMeta = {
  title?: string | null
  description?: string | null
  image: Media | null
}
export type ProductCategoryModel = Pick<
  ProductCategory,
  'id' | 'title' | 'slug' | 'description'
> & { image: Media | null; meta: ProductMeta }
export type ProductCard = Pick<Product, 'id' | 'title' | 'slug' | 'summary'> & {
  categorySlug: string
  cover: Media | null
}
export type ProductDownload = {
  id: string
  title: string
  size: number | null
  format: string | null
  url: string | null
}
export type ProductDetail = Omit<
  Product,
  'category' | 'gallery' | 'highlights' | 'downloads' | 'meta' | 'relatedProducts'
> & {
  category: ProductCategoryModel | null
  gallery: Media[]
  highlights: string[]
  downloads: ProductDownload[]
  meta: ProductMeta
  relatedProducts: string[]
}
