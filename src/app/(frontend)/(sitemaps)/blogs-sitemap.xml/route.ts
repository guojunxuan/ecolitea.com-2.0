import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
})[character]!)

const validLastmod = (value: string | null | undefined, fallback: string) =>
  value && !Number.isNaN(Date.parse(value)) ? value : fallback

const getBlogsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const siteURL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://example.com'
    const now = new Date()
    const fallback = now.toISOString()

    const categories = [] as { id: string; slug: string }[]
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'blog-categories',
        depth: 0,
        limit: 100,
        page,
        overrideAccess: false,
        sort: '_order',
        select: { slug: true },
      })
      categories.push(...result.docs)
      hasNextPage = result.hasNextPage
      page += 1
    }

    const blogs = [] as { slug: string; category: string | { id: string }; publishedAt?: string | null; updatedAt: string }[]
    page = 1
    hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'blogs',
        depth: 0,
        draft: false,
        limit: 100,
        page,
        overrideAccess: false,
        select: { slug: true, category: true, publishedAt: true, updatedAt: true },
        where: publicBlogVisibility(now),
      })
      blogs.push(...result.docs)
      hasNextPage = result.hasNextPage
      page += 1
    }

    const categoryIDs = new Set(blogs.map(({ category }) =>
      typeof category === 'object' && category !== null ? category.id : category,
    ))
    return [
      { loc: escapeXml(`${siteURL}/blogs`) },
      ...categories
        .filter(({ id, slug }) => Boolean(slug) && categoryIDs.has(id))
        .map(({ slug }) => ({
          loc: escapeXml(`${siteURL}/blogs/category/${slug}`),
        })),
      ...blogs
        .filter(({ slug }) => Boolean(slug))
        .map(({ slug, updatedAt, publishedAt }) => ({
          loc: escapeXml(`${siteURL}/blogs/${slug}`),
          lastmod: validLastmod(updatedAt, validLastmod(publishedAt, fallback)),
        })),
    ]
  },
  ['blogs-sitemap'],
  { tags: ['blogs-sitemap'], revalidate: 600 },
)

export async function GET() {
  return getServerSideSitemap(await getBlogsSitemap())
}
