// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { APIError } from 'payload'
import { preventReferencedDelete } from '@/collections/ProductCategories/hooks/preventReferencedDelete'

describe('category reference deletion guard', () => {
  it.each(['published', 'draft', 'both'])('rejects %s references without writes', async (view) => {
    const find = vi.fn(async ({ draft }) => ({ docs: view === 'both' || draft === (view === 'draft') ? [{ id: 'p', title: 'Tea' }] : [] }))
    const payload = { find, findByID: vi.fn(async () => ({ title: 'Bags' })), update: vi.fn(), delete: vi.fn() }
    const req = { payload }
    await expect(preventReferencedDelete({ id: 'c', req } as never)).rejects.toMatchObject({ status: 400, message: 'Cannot delete category "Bags": 1 products still use it (Tea). Move or delete them first.' })
    for (const draft of [false, true]) expect(find).toHaveBeenCalledWith({ collection: 'products', where: { category: { equals: 'c' } }, draft, overrideAccess: true, depth: 0, limit: 10, page: 1, req })
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.delete).not.toHaveBeenCalled()
  })
  it('paginates both views and deduplicates actual product IDs while limiting titles', async () => {
    const find = vi.fn(async ({ draft, page }) => ({
      docs: Array.from({ length: page === 1 ? 10 : 2 }, (_, i) => ({ id: String((page - 1) * 10 + i + (draft ? 1 : 0)), title: `Tea${(page - 1) * 10 + i}` })),
      hasNextPage: page === 1,
    }))
    const req = { payload: { find, findByID: vi.fn(async () => ({ title: 'Bags' })) } }
    const error = await preventReferencedDelete({ id: 'c', req } as never).catch((error: unknown) => error)
    expect(error).toBeInstanceOf(APIError)
    expect((error as Error).message).toBe(`Cannot delete category "Bags": 13 products still use it (${Array.from({ length: 10 }, (_, i) => `Tea${i}`).join(', ')}). Move or delete them first.`)
    expect(find).toHaveBeenCalledTimes(4)
  })
  it('allows empty categories without reading the category title', async () => {
    const req = { payload: { find: vi.fn(async () => ({ docs: [] })), findByID: vi.fn() } }
    await expect(preventReferencedDelete({ id: 'c', req } as never)).resolves.toBeUndefined()
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
})
