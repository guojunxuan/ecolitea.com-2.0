import { expect, it } from 'vitest'
import { blogFilterHref, readBlogFilterQuery, blogFilterRequest } from '@/utilities/blogs/filterURL'
it('uses canonical category routes and omits default or inactive values', () => {
  expect(
    blogFilterHref({ categoryId: 'tea', authorIds: [], sort: 'newest', dateFrom: '2026-01-01' }, [
      { id: 'tea', slug: 'tea-guides' },
    ]),
  ).toBe('/blogs/category/tea-guides')
})
it('restores repeated authors, dates and sort and resets pagination on apply', () => {
  const value = readBlogFilterQuery(
    'author=a&author=b&dateRange=custom&dateFrom=2026-01-01&sort=oldest',
    'tea',
  )
  expect(value).toEqual({
    categoryId: 'tea',
    authorIds: ['a', 'b'],
    dateRange: 'custom',
    dateFrom: '2026-01-01',
    dateTo: undefined,
    sort: 'oldest',
  })
  expect(blogFilterHref(value, [{ id: 'tea', slug: 'tea' }])).toBe(
    '/blogs/category/tea?author=a&author=b&dateRange=custom&dateFrom=2026-01-01&sort=oldest',
  )
  expect(blogFilterRequest(value, 2).toString()).toBe(
    'page=2&category=tea&author=a&author=b&dateRange=custom&dateFrom=2026-01-01&sort=oldest',
  )
})
it('defaults unsupported URL values and deduplicates author IDs', () => {
  expect(readBlogFilterQuery('author=a&author=a&sort=unknown&dateRange=no')).toEqual({
    categoryId: undefined,
    authorIds: ['a'],
    dateRange: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    sort: 'newest',
  })
})
