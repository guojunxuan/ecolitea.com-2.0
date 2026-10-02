import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type PaginatedDocs } from 'payload'
import type { Blog } from '@/payload-types'
import { publicBlogVisibility } from './publicVisibility'

export type BlogListItem = Pick<
  Blog,
  'id' | 'title' | 'slug' | 'category' | 'heroImage' | 'excerpt' | 'publishedAt'
>

/** Page and category are keys; all pages share blogs-list, and a filtered page also has its category tag. */
export async function getBlogListing(
  page: number,
  categoryId?: string,
): Promise<PaginatedDocs<BlogListItem>> {
  const cached = unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      return payload.find({
        collection: 'blogs',
        depth: 1,
        draft: false,
        limit: 12,
        page,
        overrideAccess: false,
        sort: '-publishedAt',
        select: {
          title: true,
          slug: true,
          category: true,
          heroImage: true,
          excerpt: true,
          publishedAt: true,
        },
        where: {
          and: [
            publicBlogVisibility(new Date()),
            ...(categoryId ? [{ category: { equals: categoryId } }] : []),
          ],
        },
      })
    },
    ['blogs-list', String(page), categoryId ?? 'all'],
    {
      tags: ['blogs-list', ...(categoryId ? [`blog-category-${categoryId}`] : [])],
      revalidate: 600,
    },
  )
  return cached()
}
