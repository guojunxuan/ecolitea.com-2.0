import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload, type Where } from 'payload'
import type { Product, ProductCategory } from '@/payload-types'
import { publicProductVisibility } from './publicVisibility'
import { toProductCard, toProductCategory, toProductDetail, type ProductDetail } from './models'

const cached = <T>(key: string[], tags: string[], fn: () => Promise<T>) =>
  unstable_cache(fn, key, { tags, revalidate: 600 })()
const client = () => getPayload({ config: configPromise })
const visible = (where: Where[] = []): Where => ({
  and: [publicProductVisibility(new Date()), ...where],
})
async function allProducts(where: Where[] = []): Promise<Product[]> {
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
async function allCategories(): Promise<ProductCategory[]> {
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
export const getProductCategoriesOverview = () =>
  cached(
    ['products-overview'],
    ['products-overview', 'product-categories', 'products-list'],
    async () => {
      const [categories, products] = await Promise.all([allCategories(), allProducts()])
      return categories.flatMap((category) => {
        const productCount = products.filter(
          (product) =>
            (typeof product.category === 'string' ? product.category : product.category.id) ===
            category.id,
        ).length
        if (!productCount) return []
        const { meta: _meta, ...model } = toProductCategory(category)
        return [{ ...model, productCount }]
      })
    },
  )
export const getProductCategoryBySlug = (slug: string) =>
  cached(['product-category', slug], ['product-categories', 'products-list'], async () => {
    const payload = await client()
    const result = await payload.find({
      collection: 'product-categories',
      depth: 1,
      draft: false,
      overrideAccess: false,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    const category = result.docs[0]
    if (!category) return null
    const products = await payload.find({
      collection: 'products',
      depth: 0,
      draft: false,
      overrideAccess: false,
      limit: 1,
      where: visible([{ category: { equals: category.id } }]),
    })
    return products.docs.length ? toProductCategory(category) : null
  })
export const getProductListing = (categoryId: string, page: number) =>
  cached(
    ['products-list', categoryId, String(page)],
    ['products-list', `product-category-${categoryId}`],
    async () => {
      const payload = await client()
      const result = await payload.find({
        collection: 'products',
        depth: 1,
        draft: false,
        overrideAccess: false,
        limit: 12,
        page,
        sort: '-publishedAt',
        where: visible([{ category: { equals: categoryId } }]),
      })
      return {
        docs: result.docs.map(toProductCard),
        page: result.page ?? page,
        totalPages: result.totalPages,
      }
    },
  )
export async function getProductBySlug(
  slug: string,
  { draft = false }: { draft?: boolean } = {},
): Promise<ProductDetail | null> {
  if (draft) {
    const payload = await client()
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return null
    const result = await payload.find({
      collection: 'products',
      depth: 1,
      draft: true,
      overrideAccess: false,
      user,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    return result.docs[0] ? toProductDetail(result.docs[0]) : null
  }
  // Resolve the current slug before caching by stable ID, as in Blogs.
  const lookupPayload = await client()
  const lookup = await lookupPayload.find({
    collection: 'products',
    depth: 0,
    draft: false,
    overrideAccess: false,
    limit: 1,
    select: {},
    where: visible([{ slug: { equals: slug } }]),
  })
  const id = lookup.docs[0]?.id
  if (!id) return null
  return cached(
    ['product-detail', id],
    [`product-${id}`, 'products-list', 'product-categories'],
    async () => {
      const payload = await client()
      const result = await payload.find({
        collection: 'products',
        depth: 1,
        draft: false,
        overrideAccess: false,
        limit: 1,
        where: visible([{ id: { equals: id } }]),
      })
      return result.docs[0] ? toProductDetail(result.docs[0]) : null
    },
  )
}
export const getRelatedProducts = (product: ProductDetail) =>
  cached(
    [
      'product-related',
      product.id,
      product.category?.id ?? '',
      JSON.stringify(product.relatedProducts),
    ],
    [
      'products-list',
      `product-${product.id}`,
      ...(product.category ? [`product-category-${product.category.id}`] : []),
    ],
    async () => {
      const payload = await client()
      const ids = [...new Set(product.relatedProducts)].filter((id) => id !== product.id)
      const selected: Product[] = []
      if (ids.length) {
        const result = await payload.find({
          collection: 'products',
          depth: 1,
          draft: false,
          overrideAccess: false,
          pagination: false,
          limit: ids.length,
          where: visible([{ id: { in: ids } }, { id: { not_in: [product.id] } }]),
        })
        const byId = new Map(result.docs.map((doc) => [doc.id, doc]))
        for (const id of ids) {
          const doc = byId.get(id)
          if (doc && selected.length < 4) selected.push(doc)
        }
      }
      if (selected.length < 4 && product.category) {
        const result = await payload.find({
          collection: 'products',
          depth: 1,
          draft: false,
          overrideAccess: false,
          limit: 4 - selected.length,
          sort: '-publishedAt',
          where: visible([
            { category: { equals: product.category.id } },
            { id: { not_in: [product.id, ...selected.map((doc) => doc.id)] } },
          ]),
        })
        for (const doc of result.docs)
          if (
            doc.id !== product.id &&
            !selected.some((item) => item.id === doc.id) &&
            selected.length < 4
          )
            selected.push(doc)
      }
      return selected.map(toProductCard)
    },
  )
export const getProductStaticParams = () =>
  cached(
    ['products-static-params'],
    ['products-sitemap', 'products-list', 'product-categories'],
    async () => {
      const [categories, products] = await Promise.all([allCategories(), allProducts()])
      const active = categories.filter((category) =>
        products.some(
          (product) =>
            (typeof product.category === 'string' ? product.category : product.category.id) ===
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
