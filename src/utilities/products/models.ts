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
export type ProductCard = Pick<Product, 'id' | 'title' | 'slug' | 'excerpt'> & {
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
  'category' | 'gallery' | 'downloads' | 'meta' | 'relatedProducts'
> & {
  category: ProductCategoryModel | null
  gallery: Media[]
  downloads: ProductDownload[]
  meta: ProductMeta
  relatedProducts: string[]
}
const media = (value: string | Media | null | undefined): Media | null =>
  value && typeof value === 'object' ? value : null
const meta = (value: Product['meta']): ProductMeta => ({
  title: value?.title,
  description: value?.description,
  image: media(value?.image),
})
export const toProductCategory = (value: ProductCategory): ProductCategoryModel => ({
  id: value.id,
  title: value.title,
  slug: value.slug,
  description: value.description,
  image: media(value.image),
  meta: meta(value.meta),
})
export const toProductCard = (value: Product): ProductCard => ({
  id: value.id,
  title: value.title,
  slug: value.slug,
  categorySlug: value.categorySlug ?? '',
  excerpt: value.excerpt,
  cover: media(value.gallery?.[0]),
})
export const toProductDetail = (value: Product): ProductDetail => ({
  ...value,
  category: typeof value.category === 'object' ? toProductCategory(value.category) : null,
  gallery: (value.gallery ?? []).flatMap((item) => media(item) ?? []),
  downloads: (value.downloads ?? []).flatMap((item) =>
    typeof item === 'object'
      ? [
          {
            id: item.id,
            title: item.title,
            size: item.filesize ?? null,
            format: item.filename?.split('.').pop()?.toLowerCase() ?? null,
            url: item.url ?? null,
          },
        ]
      : [],
  ),
  meta: meta(value.meta),
  relatedProducts: (value.relatedProducts ?? []).map((item) =>
    typeof item === 'string' ? item : item.id,
  ),
})
