import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  captureProductPublicState,
  captureProductWriteIntent,
  getProductPublicTransition,
} from '@/collections/Products/hooks/productPublicTransition'
import { redirectProduct } from '@/collections/Products/hooks/productRedirects'
import { revalidateProduct } from '@/collections/Products/hooks/revalidateProduct'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

const publicDoc = { id: 'p', slug: 'live', categorySlug: 'tea', _status: 'published' }
const request = () => ({
  context: {},
  payload: {
    logger: { warn: vi.fn(), debug: vi.fn() },
    findByID: vi.fn().mockResolvedValue(publicDoc),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
})

describe('product public transition hook boundary', () => {
  it.each([false, true])(
    'does no public reads, redirect queries or invalidation for draft:true, autosave:%s',
    async (autosave) => {
      const req = request()
      const doc = { ...publicDoc, slug: 'private', _status: 'draft' }
      captureProductWriteIntent({
        req,
        operation: 'update',
        args: { draft: true, autosave },
      } as never)
      await captureProductPublicState({
        req,
        operation: 'update',
        data: doc,
        originalDoc: publicDoc,
      } as never)
      await redirectProduct({ req, doc, previousDoc: publicDoc } as never)
      await revalidateProduct({ req, doc, previousDoc: publicDoc } as never)
      expect(req.payload.findByID).toHaveBeenCalledTimes(0)
      expect(req.payload.find).toHaveBeenCalledTimes(0)
      expect(revalidatePath).toHaveBeenCalledTimes(0)
      expect(revalidateTag).toHaveBeenCalledTimes(0)
    },
  )

  it.each([
    { name: 'omitted draft', operation: 'update', args: {} },
    { name: 'explicit draft:false', operation: 'update', args: { draft: false } },
    { name: 'autosave without draft', operation: 'update', args: { autosave: true } },
    { name: 'restored draft version', operation: 'restoreVersion', args: {} },
  ])(
    'captures an unpublish with $name after a draft write on the same request',
    async ({ operation, args }) => {
      const req = { ...request(), query: { draft: 'true', autosave: 'true' } }
      const doc = { ...publicDoc, _status: 'draft' }
      captureProductWriteIntent({ req, operation: 'update', args: { draft: true } } as never)
      await captureProductPublicState({
        req,
        operation: 'update',
        data: doc,
        originalDoc: publicDoc,
      } as never)
      captureProductWriteIntent({ req, operation, args } as never)
      req.payload.findByID.mockResolvedValueOnce(publicDoc).mockResolvedValueOnce(doc)
      await captureProductPublicState({
        req,
        operation: 'update',
        data: doc,
        originalDoc: doc,
      } as never)
      expect(await getProductPublicTransition(req as never, doc as never, doc as never)).toEqual({
        before: publicDoc,
        after: null,
      })
      await redirectProduct({ req, doc, previousDoc: doc } as never)
      await revalidateProduct({ req, doc, previousDoc: doc } as never)
      expect(req.payload.findByID).toHaveBeenCalledTimes(2)
      expect(req.payload.find).not.toHaveBeenCalled()
      expect(req.payload.create).not.toHaveBeenCalled()
      expect(req.payload.update).not.toHaveBeenCalled()
      expect(req.payload.delete).not.toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/products/tea/live')
      expect(revalidateTag).toHaveBeenCalledWith('products-sitemap', 'max')
    },
  )

  it('replaces interrupted state and clears a draft marker before the next publish on the same request', async () => {
    const req = request()
    await captureProductPublicState({
      req,
      operation: 'update',
      data: { _status: 'published' },
      originalDoc: publicDoc,
    } as never)
    req.payload.findByID.mockClear()
    captureProductWriteIntent({ req, operation: 'update', args: { draft: true } } as never)
    await captureProductPublicState({
      req,
      operation: 'update',
      data: { _status: 'draft' },
      originalDoc: publicDoc,
    } as never)
    expect(
      await getProductPublicTransition(
        req as never,
        { ...publicDoc, _status: 'draft' } as never,
        publicDoc as never,
      ),
    ).toEqual({ before: null, after: null })
    expect(req.payload.findByID).not.toHaveBeenCalled()
    await revalidateProduct({
      req,
      doc: { ...publicDoc, _status: 'draft' },
      previousDoc: publicDoc,
    } as never)
    expect(
      await getProductPublicTransition(req as never, publicDoc as never, publicDoc as never),
    ).toEqual({ before: publicDoc, after: publicDoc })
    captureProductWriteIntent({ req, operation: 'update', args: {} } as never)
    await captureProductPublicState({
      req,
      operation: 'update',
      data: { _status: 'published' },
      originalDoc: publicDoc,
    } as never)
    expect(await getProductPublicTransition(req as never, publicDoc as never)).toEqual({
      before: publicDoc,
      after: publicDoc,
    })
    expect(req.payload.findByID).toHaveBeenCalledTimes(2)
  })
})
