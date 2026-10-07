import { beforeEach, describe, expect, it, vi } from 'vitest'
const { find } = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find })) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
import {
  getPublicBlogResults,
  parsePublicBlogFilters,
} from '@/utilities/blogs/getPublicBlogResults'
import { GET } from '@/app/(frontend)/api/public-blog-list/route'

beforeEach(() => find.mockReset())
describe('public blog results', () => {
  it('defaults to page one', () => {
    expect(parsePublicBlogFilters(new URLSearchParams())).toEqual({
      page: 1,
    })
  })
  it.each([
    'page=0',
    'page=1.5',
    'page=2abc',
    'page=10001',
    'page=9007199254740992',
    'sort=random',
    'sort=oldest',
    'sort=title-asc',
    'author=a1',
    'dateRange=7d',
    'dateFrom=2026-10-01',
    'dateTo=2026-10-01',
    'category=$bad',
    'author=',
    'dateRange=bad',
    'dateRange=custom',
    'dateFrom=2026-02-30',
    'dateFrom=2026-10-03&dateTo=2026-10-01',
    'dateRange=7d&dateFrom=2026-10-01',
    'page=1&page=2',
    'limit=99',
  ])('rejects malformed %s', (query) => {
    expect(() => parsePublicBlogFilters(new URLSearchParams(query))).toThrow()
  })
  it('combines public visibility and category with a narrow projection', async () => {
    find.mockResolvedValue({
      docs: [{ id: 'b1', title: 'Tea', authors: [{ email: 'private' }], content: 'private' }],
      page: 2,
      totalPages: 3,
      totalDocs: 25,
      hasNextPage: true,
      hasPrevPage: true,
      nextPage: 3,
      prevPage: 1,
    })
    const filters = parsePublicBlogFilters(new URLSearchParams('page=2&category=cat-a'))
    const result = await getPublicBlogResults(filters, new Date('2026-10-06T12:00:00Z'))
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        overrideAccess: false,
        depth: 1,
        limit: 12,
        page: 2,
        sort: ['-publishedAt', 'id'],
        select: {
          title: true,
          slug: true,
          category: true,
          heroImage: true,
          excerpt: true,
          publishedAt: true,
        },
      }),
    )
    expect(find.mock.calls[0][0].where.and).toEqual([
      {
        _status: { equals: 'published' },
        publishedAt: { less_than_equal: '2026-10-06T12:00:00.000Z' },
      },
      { category: { equals: 'cat-a' } },
    ])
    expect(result.docs[0]).not.toHaveProperty('authors')
    expect(result.docs[0]).not.toHaveProperty('content')
    expect(result.hasNextPage).toBe(true)
  })
  it('returns 400 without database access for malformed requests', async () => {
    const response = await GET(new Request('https://example.test/api/public-blog-list?page=0'))
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(find).not.toHaveBeenCalled()
  })
  it('returns no-store public pagination', async () => {
    find.mockResolvedValue({ docs: [], page: 1, totalPages: 1, totalDocs: 0, hasNextPage: false })
    const response = await GET(new Request('https://example.test/api/public-blog-list'))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      docs: [],
      page: 1,
      limit: 12,
      hasNextPage: false,
    })
  })
})
