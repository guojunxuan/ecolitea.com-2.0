import configPromise from '@payload-config'
import { getPayload, type Where } from 'payload'
import type { BlogListItem } from './getBlogListing'
import { publicBlogVisibility } from './publicVisibility'

const sorts = {
  newest: '-publishedAt',
  oldest: 'publishedAt',
  'title-asc': 'title',
  'title-desc': '-title',
} as const
export type PublicBlogFilters = {
  page: number
  sort: keyof typeof sorts
  categoryId?: string
  authorIds: string[]
  dateRange?: '7d' | '30d' | '3m' | '1y' | 'custom'
  dateFrom?: string
  dateTo?: string
}
export class InvalidPublicBlogFilters extends Error {}
const invalid = (): never => {
  throw new InvalidPublicBlogFilters('Invalid blog filters')
}
const validID = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value

/** Public URL contract: repeated author IDs; custom dates are inclusive UTC calendar days. */
export function parsePublicBlogFilters(params: URLSearchParams): PublicBlogFilters {
  const allowed = ['page', 'sort', 'category', 'author', 'dateRange', 'dateFrom', 'dateTo']
  for (const key of params.keys()) {
    if (!allowed.includes(key) || (key !== 'author' && params.getAll(key).length > 1)) invalid()
  }
  const pageValue = params.get('page') ?? '1'
  const page = Number(pageValue)
  if (!/^[1-9]\d*$/.test(pageValue) || !Number.isSafeInteger(page) || page > 10000) invalid()
  const sort = params.get('sort') ?? 'newest'
  if (!Object.hasOwn(sorts, sort)) invalid()
  const categoryId = params.get('category') ?? undefined
  if (categoryId !== undefined && !validID(categoryId)) invalid()
  const authorIds = [...new Set(params.getAll('author'))]
  if (authorIds.length > 50 || authorIds.some((id) => !validID(id))) invalid()
  const dateRange = params.get('dateRange') ?? undefined
  if (dateRange !== undefined && !['7d', '30d', '3m', '1y', 'custom'].includes(dateRange)) invalid()
  const dateFrom = params.get('dateFrom') ?? undefined
  const dateTo = params.get('dateTo') ?? undefined
  if (
    (dateFrom !== undefined && !validDay(dateFrom)) ||
    (dateTo !== undefined && !validDay(dateTo))
  )
    invalid()
  if (dateFrom && dateTo && dateFrom > dateTo) invalid()
  if (dateRange && dateRange !== 'custom' && (dateFrom || dateTo)) invalid()
  if (dateRange === 'custom' && !dateFrom && !dateTo) invalid()
  return {
    page,
    sort: sort as PublicBlogFilters['sort'],
    authorIds,
    ...(categoryId ? { categoryId } : {}),
    ...(dateRange ? { dateRange: dateRange as PublicBlogFilters['dateRange'] } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }
}

export async function getPublicBlogResults(filters: PublicBlogFilters, now = new Date()) {
  const and: Where[] = [publicBlogVisibility(now)]
  if (filters.categoryId) and.push({ category: { equals: filters.categoryId } })
  if (filters.authorIds.length) and.push({ authors: { in: filters.authorIds } })
  const days = { '7d': 7, '30d': 30, '3m': 90, '1y': 365 }
  if (filters.dateRange && filters.dateRange !== 'custom') {
    and.push({
      publishedAt: {
        greater_than_equal: new Date(
          now.getTime() - days[filters.dateRange] * 86400000,
        ).toISOString(),
      },
    })
  } else if (filters.dateFrom || filters.dateTo) {
    and.push({
      publishedAt: {
        ...(filters.dateFrom
          ? { greater_than_equal: new Date(filters.dateFrom).toISOString() }
          : {}),
        ...(filters.dateTo
          ? { less_than: new Date(Date.parse(filters.dateTo) + 86400000).toISOString() }
          : {}),
      },
    })
  }
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection: 'blogs',
    depth: 1,
    draft: false,
    overrideAccess: false,
    limit: 12,
    page: filters.page,
    sort: [sorts[filters.sort], 'id'],
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
