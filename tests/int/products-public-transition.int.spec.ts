import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import { captureProductPublicState, getProductPublicTransition } from '@/collections/Products/hooks/productPublicTransition'
import { redirectProduct } from '@/collections/Products/hooks/productRedirects'
import { revalidateProduct } from '@/collections/Products/hooks/revalidateProduct'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

const publicDoc = { id: 'p', slug: 'live', categorySlug: 'tea', _status: 'published' }
const request = () => ({ context: {}, payload: {
  findByID: vi.fn().mockResolvedValue(publicDoc),
  find: vi.fn().mockResolvedValue({ docs: [] }),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
} })

describe('product public transition hook boundary', () => {
  it.each(['draft save', 'autosave'])('does no public reads, redirect queries or invalidation for %s', async () => {
    const req = request()
    const doc = { ...publicDoc, slug: 'private', _status: 'draft' }
    await captureProductPublicState({ req, operation: 'update', data: doc, originalDoc: publicDoc } as never)
    await redirectProduct({ req, doc, previousDoc: publicDoc } as never)
    await revalidateProduct({ req, doc, previousDoc: publicDoc } as never)
    expect(req.payload.findByID).toHaveBeenCalledTimes(0)
    expect(req.payload.find).toHaveBeenCalledTimes(0)
    expect(revalidatePath).toHaveBeenCalledTimes(0)
    expect(revalidateTag).toHaveBeenCalledTimes(0)
  })

  it('replaces interrupted state and clears a draft marker before the next publish on the same request', async () => {
    const req = request()
    await captureProductPublicState({ req, operation: 'update', data: { _status: 'published' }, originalDoc: publicDoc } as never)
    req.payload.findByID.mockClear()
    await captureProductPublicState({ req, operation: 'update', data: { _status: 'draft' }, originalDoc: publicDoc } as never)
    expect(await getProductPublicTransition(req as never, { ...publicDoc, _status: 'draft' } as never, publicDoc as never)).toEqual({ before: null, after: null })
    expect(req.payload.findByID).not.toHaveBeenCalled()
    await revalidateProduct({ req, doc: { ...publicDoc, _status: 'draft' }, previousDoc: publicDoc } as never)
    expect(await getProductPublicTransition(req as never, publicDoc as never, publicDoc as never)).toEqual({ before: publicDoc, after: publicDoc })
    await captureProductPublicState({ req, operation: 'update', data: { _status: 'published' }, originalDoc: publicDoc } as never)
    expect(await getProductPublicTransition(req as never, publicDoc as never)).toEqual({ before: publicDoc, after: publicDoc })
    expect(req.payload.findByID).toHaveBeenCalledTimes(2)
  })
})
