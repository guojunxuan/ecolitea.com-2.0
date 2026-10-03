import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { find, auth, unstableCache } = vi.hoisted(() => ({
  find: vi.fn(),
  auth: vi.fn(),
  unstableCache: vi.fn((fn: () => unknown) => fn),
}))

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({ find, auth })) }))
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))

import { getBlogListing } from '@/utilities/blogs/getBlogListing'
import { getBlogBySlug } from '@/utilities/blogs/getBlogBySlug'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T12:00:00.000Z'))
  find.mockReset()
  auth.mockReset()
  unstableCache.mockClear()
})

afterEach(() => vi.useRealTimers())

describe('public blog queries', () => {
  it('lists only published, due blogs in pages of 12 with narrow fields', async () => {
    const result = { docs: [], totalDocs: 0, page: 2 }
    find.mockResolvedValue(result)

    await expect(getBlogListing(2)).resolves.toBe(result)

    expect(find).toHaveBeenCalledWith({
      collection: 'blogs',
      depth: 1,
      draft: false,
      limit: 12,
      page: 2,
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
          {
            _status: { equals: 'published' },
            publishedAt: { less_than_equal: '2026-10-02T12:00:00.000Z' },
          },
        ],
      },
    })
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['blogs-list', '2', 'all'], {
      tags: ['blogs-list'],
      revalidate: 600,
    })
  })

  it('filters by category and tags the category cache', async () => {
    find.mockResolvedValue({ docs: [] })
    await getBlogListing(1, 'cat-a')
    expect(find.mock.calls[0][0].where.and).toContainEqual({ category: { equals: 'cat-a' } })
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['blogs-list', '1', 'cat-a'], {
      tags: ['blogs-list', 'blog-category-cat-a'],
      revalidate: 600,
    })
  })

  it('finds a public detail by stable ID and tags its cached body', async () => {
    const blog = { id: 'b1', slug: 'hello', title: 'Hello' }
    find.mockResolvedValueOnce({ docs: [{ id: 'b1' }] }).mockResolvedValueOnce({ docs: [blog] })
    await expect(getBlogBySlug('hello', false)).resolves.toEqual(blog)
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'blogs',
        depth: 0,
        select: {},
        where: {
          and: [
            {
              _status: { equals: 'published' },
              publishedAt: { less_than_equal: '2026-10-02T12:00:00.000Z' },
            },
            { slug: { equals: 'hello' } },
          ],
        },
      }),
    )
    expect(find.mock.calls[1][0].where.and).toContainEqual({ id: { equals: 'b1' } })
    expect(unstableCache).toHaveBeenCalledWith(expect.any(Function), ['blog-detail', 'b1'], {
      tags: ['blog-b1', 'blog-categories'],
      revalidate: 600,
    })
  })

  it('keeps draft preview uncached and asks Payload for draft content', async () => {
    const blog = { id: 'draft', slug: 'preview' }
    auth.mockResolvedValue({ user: { id: 'editor' } })
    find.mockResolvedValue({ docs: [blog] })
    await expect(getBlogBySlug('preview', true)).resolves.toEqual(blog)
    expect(unstableCache).not.toHaveBeenCalled()
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: true,
        overrideAccess: false,
        user: { id: 'editor' },
        where: { slug: { equals: 'preview' } },
      }),
    )
  })

  it('does not expose drafts without an authenticated preview user', async () => {
    auth.mockResolvedValue({ user: null })
    await expect(getBlogBySlug('preview', true)).resolves.toBeNull()
    expect(find).not.toHaveBeenCalled()
  })
})
