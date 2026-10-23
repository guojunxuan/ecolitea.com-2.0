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
export type ProductSpecification = { group?: string | null; label: string; value: string }
export type ProductOptionValue = {
  key: string
  label: string
  swatch: string | null
  thumbnail: Media | null
  gallery: Media[]
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
  | 'category'
  | 'gallery'
  | 'highlights'
  | 'sections'
  | 'meta'
  | 'relatedProducts'
  | 'options'
  | 'specifications'
> & {
  options: ProductOption[]
  specifications: ProductSpecification[]
  defaultSelection: Record<string, string>
  resolvedGallery: Media[]
  resolvedSpecifications: ProductSpecification[]
  category: ProductCategoryModel | null
  gallery: Media[]
  highlights: string[]
  sections: {
    label: string
    anchor: string
    blocks: NonNullable<NonNullable<Product['sections']>[number]['blocks']>
  }[]
  meta: ProductMeta
  relatedProducts: string[]
}
