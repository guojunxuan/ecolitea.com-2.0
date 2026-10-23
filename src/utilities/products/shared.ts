import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import type { Media, Product, ProductCategory } from '@/payload-types'
import type { ProductCard, ProductCategoryModel, ProductDetail, ProductMeta } from './models'
import { publicProductVisibility } from './publicVisibility'

export const cached = <T>(key: string[], tags: string[], fn: () => Promise<T>) =>
  unstable_cache(fn, key, { tags, revalidate: 600 })()
export const client = () => getPayload({ config: configPromise })
export const visible = (where: Where[] = []): Where => ({
  and: [publicProductVisibility(new Date()), ...where],
})
export async function allProducts(where: Where[] = []): Promise<Product[]> {
  const payload = await client()
  const docs: Product[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'products',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: 100,
      page,
      sort: '-publishedAt',
      where: visible(where),
    })
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
    page++
  }
}
export async function allCategories(): Promise<ProductCategory[]> {
  const payload = await client()
  const docs: ProductCategory[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'product-categories',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: 100,
      page,
      sort: '_order',
    })
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
    page++
  }
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
  category:
    value.category && typeof value.category === 'object' ? toProductCategory(value.category) : null,
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
