import { getServerSideURL } from '@/utilities/getURL'
import { localizeSitemap, sitemapLocaleKey, sitemapLocaleTags } from '@/utilities/i18n/seo'
import { productCategoryPath, productPath } from '@/utilities/products/paths'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import { publicProductVisibility } from '@/utilities/products/publicVisibility'

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  )

const validLastmod = (value: string | null | undefined, fallback: string) =>
  value && !Number.isNaN(Date.parse(value)) ? value : fallback

const getProductsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const siteURL = getServerSideURL()
    const now = new Date()
    const fallback = now.toISOString()

    const categories = [] as { id: string; slug: string; updatedAt?: string }[]
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'product-categories',
        depth: 0,
        limit: 100,
        page,
        overrideAccess: false,
        sort: '_order',
        select: { slug: true, updatedAt: true },
      })
      categories.push(...result.docs)
      hasNextPage = result.hasNextPage
      page += 1
    }

    const products = [] as {
      id: string
      slug: string
      categorySlug?: string | null
      category: string | { id: string }
      publishedAt?: string | null
      updatedAt: string
    }[]
    page = 1
    hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'products',
        depth: 0,
        draft: false,
        limit: 100,
        page,
        overrideAccess: false,
        select: {
          slug: true,
          categorySlug: true,
          category: true,
          publishedAt: true,
          updatedAt: true,
        },
        where: publicProductVisibility(now),
      })
      products.push(...result.docs)
      hasNextPage = result.hasNextPage
      page += 1
    }

    const visibleProducts = products.filter(({ slug, categorySlug }) => slug && categorySlug)
    const categoryIDs = new Set(
      visibleProducts.map(({ category }) =>
        typeof category === 'object' && category !== null ? category.id : category,
      ),
    )
    return localizeSitemap(
      [
        { entry: { loc: escapeXml(`${siteURL}/products`) } },
        ...categories
          .filter(({ id, slug }) => Boolean(slug) && categoryIDs.has(id))
          .map(({ id, slug, updatedAt }) => ({
            sourceCollection: 'product-categories',
            sourceId: id,
            entry: {
              loc: escapeXml(`${siteURL}${productCategoryPath(slug)}`),
              ...(updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? { lastmod: updatedAt } : {}),
            },
          })),
        ...visibleProducts.map(({ id, slug, categorySlug, updatedAt, publishedAt }) => ({
          sourceCollection: 'products',
          sourceId: id,
          entry: {
            loc: escapeXml(`${siteURL}${productPath(categorySlug!, slug)}`),
            lastmod: validLastmod(updatedAt, validLastmod(publishedAt, fallback)),
          },
        })),
      ],
      payload,
    )
  },
  ['products-sitemap', ...sitemapLocaleKey()],
  { tags: ['products-sitemap', ...sitemapLocaleTags()], revalidate: 600 },
)

export async function GET() {
  return getServerSideSitemap(await getProductsSitemap())
}
