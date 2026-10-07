import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import type { BlogListItem } from './getBlogListing'
import { publicBlogVisibility } from './publicVisibility'

export type PublicBlogFilters = { page: number; categoryId?: string }
export class InvalidPublicBlogFilters extends Error {}
const invalid = (): never => {
  throw new InvalidPublicBlogFilters('Invalid blog filters')
}
const validID = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value)
export function parsePublicBlogFilters(params: URLSearchParams): PublicBlogFilters {
  for (const key of params.keys()) {
    if (!['page', 'category'].includes(key) || params.getAll(key).length > 1) invalid()
  }
  const pageValue = params.get('page') ?? '1'
  const page = Number(pageValue)
  if (!/^[1-9]\d*$/.test(pageValue) || !Number.isSafeInteger(page) || page > 10000) invalid()
  const categoryId = params.get('category') ?? undefined
  if (categoryId !== undefined && !validID(categoryId)) invalid()
  return { page, ...(categoryId ? { categoryId } : {}) }
}

export async function getPublicBlogResults(filters: PublicBlogFilters, now = new Date()) {
  const and: Where[] = [publicBlogVisibility(now)]
  if (filters.categoryId) and.push({ category: { equals: filters.categoryId } })
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'blogs',
    depth: 1,
    draft: false,
    overrideAccess: false,
    limit: 12,
    page: filters.page,
    sort: ['-publishedAt', 'id'],
    select: {
      title: true,
      slug: true,
      category: true,
      heroImage: true,
      excerpt: true,
      publishedAt: true,
    },
    where: { and },
  })
  // Explicit projection also protects the response if query hooks add fields.
  const docs: BlogListItem[] = result.docs.map(
    ({ id, title, slug, category, heroImage, excerpt, publishedAt }) => ({
      id,
      title,
      slug,
      category,
      heroImage,
      excerpt,
      publishedAt,
    }),
  )
  return {
    docs,
    page: result.page ?? filters.page,
    limit: 12,
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
    hasNextPage: result.hasNextPage,
    hasPrevPage: result.hasPrevPage,
    nextPage: result.nextPage,
    prevPage: result.prevPage,
  }
}
