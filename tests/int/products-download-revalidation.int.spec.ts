import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidateTag } from 'next/cache'
import { revalidateProductDownloads } from '@/collections/Documents/hooks/revalidateProductDownloads'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

const doc = { id: 'guide', title: 'Guide' }
const find = vi.fn()

function change(disableRevalidate = false) {
  const req = { context: { disableRevalidate }, payload: { find } }
  return { req, result: revalidateProductDownloads({ doc, req } as never) }
}

beforeEach(() => vi.resetAllMocks())

describe('product download cache invalidation', () => {
  it('invalidates references on every results page through the same request', async () => {
    find
      .mockResolvedValueOnce({ docs: [{ id: 'first' }, { id: 'second' }], hasNextPage: true })
      .mockResolvedValueOnce({ docs: [{ id: 'third' }], hasNextPage: false })
    const { req, result } = change()
    expect(await result).toBe(doc)
    const query = {
      collection: 'products',
      where: { resources: { in: ['guide'] } },
      select: {},
      depth: 0,
      draft: false,
      limit: 100,
      overrideAccess: true,
      req,
    }
    expect(find).toHaveBeenNthCalledWith(1, { ...query, page: 1 })
    expect(find).toHaveBeenNthCalledWith(2, { ...query, page: 2 })
    expect(vi.mocked(revalidateTag).mock.calls).toEqual(
      ['first', 'second', 'third'].map((id) => [`product-${id}`, { expire: 0 }]),
    )
  })

  it('leaves the cache untouched when no products reference the document', async () => {
    find.mockResolvedValue({ docs: [], hasNextPage: false })
    expect(await change().result).toBe(doc)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('does not query or invalidate if revalidation is disabled', async () => {
    expect(await change(true).result).toBe(doc)
    expect(find).not.toHaveBeenCalled()
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
