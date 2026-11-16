import { getLocalizedList, readyTranslationFilter } from '../i18n/getLocalized'
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
  locale = 'en',
): Promise<PaginatedDocs<BlogListItem>> {
  const cached = unstable_cache(
    async () => {
      const payload = await getPayload({ config: configPromise })
      const result = await payload.find({
        collection: 'blogs',
        depth: 1,
        draft: false,
        limit: 12,
        page,
        overrideAccess: false,
        sort: ['-publishedAt', 'id'],
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
            ...(await readyTranslationFilter(payload, 'blogs', locale)),
            ...(categoryId ? [{ category: { equals: categoryId } }] : []),
          ],
        },
      })
      return { ...result, docs: await getLocalizedList(result.docs, 'blogs', locale, payload) }
    },
    ['blogs-list', String(page), categoryId ?? 'all', locale],
    {
      tags: [
        'blogs-list',
        `translations:${locale}`,
        ...(categoryId ? [`blog-category-${categoryId}`] : []),
      ],
      revalidate: 600,
    },
  )
  return cached()
}
