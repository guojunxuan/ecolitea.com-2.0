import { describe, expect, it, vi } from 'vitest'
const { find, cache } = vi.hoisted(() => ({
  find: vi.fn(),
  cache: vi.fn((fn: () => unknown) => fn),
}))
vi.mock('payload', () => ({ getPayload: async () => ({ find }) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/cache', () => ({ unstable_cache: cache }))
import { getPublicBlogAuthors } from '@/utilities/blogs/getPublicBlogAuthors'
describe('public blog authors', () => {
  it('projects unique public identities and asks only for due published blogs', async () => {
    find.mockResolvedValue({
      docs: [
        { populatedAuthors: [{ id: 'a', name: 'Jane', email: 'private' }] },
        {
          populatedAuthors: [
            { id: 'a', name: 'Jane' },
            { id: 'b', name: 'Alex' },
          ],
        },
      ],
      hasNextPage: false,
    })
    expect(await getPublicBlogAuthors()).toEqual([
      { id: 'b', name: 'Alex' },
      { id: 'a', name: 'Jane' },
    ])
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'blogs',
        overrideAccess: false,
        draft: false,
        depth: 0,
        where: {
          _status: { equals: 'published' },
          publishedAt: { less_than_equal: expect.any(String) },
        },
      }),
    )
    expect(cache).toHaveBeenCalledWith(expect.any(Function), ['public-blog-authors'], {
      tags: ['blogs-list'],
      revalidate: 600,
    })
  })
})
