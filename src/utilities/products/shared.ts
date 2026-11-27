import { getLocalizedList } from '../i18n/getLocalized'
import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import type { Media, Product, ProductCategory } from '@/payload-types'
import type {
  ProductCard,
  ProductCategoryModel,
  ProductDetail,
  ProductDownload,
  ProductSpecification,
  ProductMeta,
} from './models'
import { publicProductVisibility } from './publicVisibility'

export const cached = <T>(key: string[], tags: string[], fn: () => Promise<T>) =>
  unstable_cache(fn, key, { tags, revalidate: 600 })()
export const client = () => getPayload({ config: configPromise })
export const visible = (where: Where[] = []): Where => ({
  and: [publicProductVisibility(new Date()), ...where],
})
export async function allProducts(where: Where[] = [], locale = 'en'): Promise<Product[]> {
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
    docs.push(...await getLocalizedList(result.docs, 'products', locale, payload))
    if (!result.hasNextPage) return docs
    page++
  }
}
export async function allCategories(locale = 'en'): Promise<ProductCategory[]> {
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
    docs.push(...await getLocalizedList(result.docs, 'product-categories', locale, payload))
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
type LegacySpecification = Partial<ProductSpecification>

function specificationRows(rows: (LegacySpecification | null)[]): ProductSpecification[] {
  return rows.flatMap((row) => {
    const label = typeof row?.label === 'string' ? row.label.trim() : ''
    const value = typeof row?.value === 'string' ? row.value.trim() : ''
    return label && value ? [{ label, value }] : []
  })
}

function toDownloads(resources: Product['resources']): ProductDownload[] {
  return (resources ?? []).flatMap((doc) => {
    if (!doc || typeof doc !== 'object') return []
    const url = doc.url?.trim()
    if (!url || !/^(https?:\/\/|\/(?![\/\\]))/i.test(url) || /[\t\r\n]/.test(url)) return []
    return [
      {
        id: doc.id,
        title: doc.title?.trim() || doc.filename?.trim() || doc.id,
        url,
        mimeType: doc.mimeType ?? null,
        filesize: doc.filesize ?? null,
      },
    ]
  })
}

export const toProductDetail = (value: Product): ProductDetail => {
  const gallery = new Map<string, Media>()
  for (const image of value.gallery ?? []) {
    const item = media(image)
    if (item && !gallery.has(item.id)) gallery.set(item.id, item)
  }
  const overview = (value.overview ?? '')
    .split(/\r?\n[ \t]*\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
  const specifications: ProductDetail['specifications'] = []
  // Keep published detail reads working until stored flat rows have been migrated.
  const groups = (value.specifications ?? []) as (
    NonNullable<Product['specifications']>[number] | LegacySpecification
  )[]
  const legacyRows = groups.filter(
    (group): group is LegacySpecification => group && !('items' in group),
  )
  const legacyItems = specificationRows(legacyRows)
  if (legacyItems.length) specifications.push({ group: null, items: legacyItems })
  for (const group of groups) {
    if (!group || !('items' in group) || !Array.isArray(group.items)) continue
    const items = specificationRows(group.items)
    if (items.length) specifications.push({ group: group.group?.trim() || null, items })
  }
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
    overview: overview.length ? overview : value.summary?.trim() ? [value.summary.trim()] : [],
    specifications,
    downloads: toDownloads(value.resources),
    category:
      value.category && typeof value.category === 'object'
        ? toProductCategory(value.category)
        : null,
    gallery: [...gallery.values()],
    sections: (value.sections ?? []).map((section) => ({
      label: section.label,
      anchor: section.anchor ?? '',
      theme: section.theme === 'inverse' ? 'inverse' : 'default',
      title: section.title?.trim() || null,
      description: section.description?.trim() || null,
      blocks: section.blocks ?? [],
    })),
    meta: meta(value.meta),
    relatedProducts: (value.relatedProducts ?? []).map((item) =>
      typeof item === 'string' ? item : item.id,
    ),
  }
}
