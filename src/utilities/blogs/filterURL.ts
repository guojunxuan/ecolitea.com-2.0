import type { BlogFilterState } from '@/components/BlogFilterPanel'

export function readBlogFilterQuery(query: string, categoryId?: string): BlogFilterState {
  const params = new URLSearchParams(query)
  const range = params.get('dateRange')
  const sort = params.get('sort')
  const dateRange = ['7d', '30d', '3m', '1y', 'custom'].includes(range ?? '')
    ? (range as BlogFilterState['dateRange'])
    : undefined
  return {
    categoryId,
    authorIds: [...new Set(params.getAll('author'))],
    dateRange,
    dateFrom: dateRange === 'custom' ? params.get('dateFrom') || undefined : undefined,
    dateTo: dateRange === 'custom' ? params.get('dateTo') || undefined : undefined,
    sort: ['oldest', 'title-asc', 'title-desc'].includes(sort ?? '')
      ? (sort as BlogFilterState['sort'])
      : 'newest',
  }
}
function appendFilters(params: URLSearchParams, filters: BlogFilterState) {
  ;[...new Set(filters.authorIds)].forEach((id) => params.append('author', id))
  if (filters.dateRange) params.set('dateRange', filters.dateRange)
  if (filters.dateRange === 'custom') {
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort)
  return params
}
export function blogFilterHref(
  filters: BlogFilterState,
  categories: { id: string; slug: string }[],
) {
  const category = categories.find((item) => item.id === filters.categoryId)
  const path = category ? `/blogs/category/${category.slug}` : '/blogs'
  const query = appendFilters(new URLSearchParams(), filters).toString()
  return query ? `${path}?${query}` : path
}
export function blogFilterRequest(filters: BlogFilterState, page: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (filters.categoryId) params.set('category', filters.categoryId)
  return appendFilters(params, filters)
}
export const hasBlogQueryFilters = (value: BlogFilterState) =>
  value.authorIds.length > 0 || Boolean(value.dateRange) || value.sort !== 'newest'
