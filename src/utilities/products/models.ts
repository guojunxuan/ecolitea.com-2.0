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
export type ProductCategoryOverview = Omit<ProductCategoryModel, 'meta'> & {
  productCount: number
  products: ProductCard[]
  imageFit: 'contain' | 'cover'
}
export type ProductSpecification = { label: string; value: string }
export type ProductSpecificationGroup = {
  group: string | null
  items: ProductSpecification[]
}
export type ProductDownload = {
  id: string
  title: string
  url: string
  mimeType: string | null
  filesize: number | null
}
export type ProductDetail = Pick<
  Product,
  | 'id'
  | 'title'
  | 'slug'
  | 'summary'
  | 'categorySlug'
  | 'publishedAt'
  | 'createdAt'
  | 'updatedAt'
  | '_status'
> & {
  overview: string[]
  specifications: ProductSpecificationGroup[]
  downloads: ProductDownload[]
  category: ProductCategoryModel | null
  gallery: Media[]
  sections: {
    label: string
    anchor: string
    blocks: NonNullable<NonNullable<Product['sections']>[number]['blocks']>
  }[]
  meta: ProductMeta
  relatedProducts: string[]
}
