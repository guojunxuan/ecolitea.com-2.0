import type { Media, Product, ProductCategory } from '@/payload-types'

export type InquiryButton = NonNullable<NonNullable<Product['inquiry']>['buttons']>[number]['link']

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
export type ProductSpecification = { label: string; value: string }
export type ProductGalleryItem = {
  media: Media
  values: { optionKey: string; valueKey: string }[]
}
export type ProductOptionValue = {
  key: string
  label: string
  swatch: string | null
  image: Media | null
  specifications: ProductSpecification[]
}
export type ProductOption = {
  key: string
  name: string
  display: 'text' | 'swatch' | 'image'
  values: ProductOptionValue[]
}
export type ProductDetail = Omit<
  Product,
  | 'inquiry'
  | 'category'
  | 'gallery'
  | 'highlights'
  | 'sections'
  | 'meta'
  | 'relatedProducts'
  | 'options'
  | 'specifications'
> & {
  inquiry: { buttons: InquiryButton[] }
  options: ProductOption[]
  specifications: ProductSpecification[]
  defaultSelection: Record<string, string>
  resolvedSpecifications: ProductSpecification[]
  category: ProductCategoryModel | null
  gallery: ProductGalleryItem[]
  highlights: string[]
  sections: {
    label: string
    anchor: string
    blocks: NonNullable<NonNullable<Product['sections']>[number]['blocks']>
  }[]
  meta: ProductMeta
  relatedProducts: string[]
}
