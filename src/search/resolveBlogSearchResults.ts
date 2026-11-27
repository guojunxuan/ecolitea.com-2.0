import type { Payload } from 'payload'
import type { Search } from '@/payload-types'
import type { CardBlogData } from '@/components/Card'

/** Search snapshots store category IDs; presentation uses the current category. */
export async function resolveBlogSearchResults(
  payload: Payload,
  results: Pick<
    Search,
    'doc' | 'title' | 'slug' | 'excerpt' | 'heroImage' | 'publishedAt' | 'category'
  >[],
): Promise<CardBlogData[]> {
  const blogs = results.filter((result) => result.doc.relationTo === 'blogs')
  const categoryIDs = [
    ...new Set(
      blogs.flatMap((result) => (result.category?.categoryID ? [result.category.categoryID] : [])),
    ),
  ]
  const categories = categoryIDs.length
    ? await payload.find({
        collection: 'blog-categories',
        where: { id: { in: categoryIDs } },
        depth: 0,
        pagination: false,
        overrideAccess: false,
        select: { title: true, slug: true, createdAt: true, updatedAt: true },
      })
    : { docs: [] }
  const byID = new Map(categories.docs.map((category) => [category.id, category]))
  return blogs.map((result) => ({
    title: result.title || '',
    slug: result.slug || '',
    excerpt: result.excerpt || '',
    heroImage: result.heroImage || '',
    publishedAt: result.publishedAt,
    category: byID.get(result.category?.categoryID || '') || '',
  }))
}
