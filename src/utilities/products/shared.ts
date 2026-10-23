import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import type { Media, Product, ProductCategory, Settings } from '@/payload-types'
import type { ProductCard, ProductCategoryModel, ProductDetail, ProductMeta } from './models'
import { resolveProductInquiry } from './inquiry'
import { optionKey } from './keys'
import { resolveOptionSelection } from './options'
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
  summary: value.summary,
  cover: media(value.gallery?.[0]),
})
export const toProductDetail = (value: Product, settings?: Settings | null): ProductDetail => {
  const options = (value.options ?? []).map((group) => ({
    key: optionKey(group.name ?? ''),
    name: group.name ?? '',
    display: group.display ?? 'text',
    values: (group.values ?? []).map((item) => ({
      key: optionKey(item.label ?? ''),
      label: item.label ?? '',
      swatch: item.swatch ?? null,
      thumbnail: media(item.thumbnail),
      gallery: (item.gallery ?? []).flatMap((image) => media(image) ?? []),
      specifications: (item.specifications ?? []).map(({ label, value }) => ({
        label: label ?? '',
        value: value ?? '',
      })),
    })),
  }))
  const defaultSelection = Object.fromEntries(
    options.flatMap((group) => (group.values[0] ? [[group.key, group.values[0].key]] : [])),
  )
  const gallery = (value.gallery ?? []).flatMap((item) => media(item) ?? [])
  const specifications = (value.specifications ?? []).map(({ group, label, value }) => ({
    group,
    label: label ?? '',
    value: value ?? '',
  }))
  const resolved = resolveOptionSelection({ gallery, specifications, options }, defaultSelection)
  return {
    id: value.id,
    title: value.title,
    slug: value.slug,
    summary: value.summary,
    categorySlug: value.categorySlug,
    publishedAt: value.publishedAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    _status: value._status,
    inquiry: resolveProductInquiry(value, settings),
    options,
    specifications,
    defaultSelection,
    resolvedGallery: resolved.gallery,
    resolvedSpecifications: resolved.specifications,
    category:
      value.category && typeof value.category === 'object'
        ? toProductCategory(value.category)
        : null,
    gallery,
    highlights: (value.highlights ?? []).map(({ text }) => text),
    sections: (value.sections ?? []).flatMap((section) =>
      section.blocks?.length
        ? [{ label: section.label ?? '', anchor: section.anchor ?? '', blocks: section.blocks }]
        : [],
    ),
    meta: meta(value.meta),
    relatedProducts: (value.relatedProducts ?? []).map((item) =>
      typeof item === 'string' ? item : item.id,
    ),
  }
}
