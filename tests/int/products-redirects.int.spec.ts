import { describe, expect, it, vi } from 'vitest'
import { revalidateTag } from 'next/cache'
import { setProductCategorySlug } from '@/collections/Products/hooks/setProductCategorySlug'
import { upsertRedirect, redirectProduct } from '@/collections/Products/hooks/productRedirects'
import { propagateCategorySlug } from '@/collections/Products/hooks/propagateCategorySlug'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const request = () => ({
  context: {},
  payload: {
    logger: { warn: vi.fn(), debug: vi.fn() },
    find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
    findByID: vi.fn().mockResolvedValue({ slug: 'new' }),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
})

describe('product redirects', () => {
  it.each([
    { type: 'custom', url: 'https://example.test/manual' },
    { type: 'reference', reference: { relationTo: 'products', value: 'other' } },
    { type: 'reference', reference: { relationTo: 'product-categories', value: 'p' } },
  ])('warns before deleting an occupied path with target $type', async (to) => {
    const req = request()
    const from = '/products/new/tea'
    const trigger = { relationTo: 'products' as const, id: 'p' }
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied', from, to }] })
    await upsertRedirect(req as never, null, trigger, from)
    expect(req.payload.logger.warn).toHaveBeenCalledExactlyOnceWith({ from, to, trigger }, 'Removing redirect occupying a live product path')
    expect(req.payload.logger.warn.mock.invocationCallOrder[0]).toBeLessThan(req.payload.delete.mock.invocationCallOrder[0])
    expect(req.payload.delete).toHaveBeenCalledExactlyOnceWith({ collection: 'redirects', id: 'occupied', req })
    expect(req.payload.logger.debug).not.toHaveBeenCalled()
  })

  it.each([
    { relationTo: 'products' as const, value: '42' },
    { relationTo: 'products' as const, value: { id: 42, slug: 'tea' } },
    { relationTo: 'product-categories' as const, value: { id: '42', slug: 'tea' } },
  ])('debugs instead of warning before deleting a self reference $relationTo', async (reference) => {
    const req = request()
    const from = '/products/new/tea'
    const trigger = { relationTo: reference.relationTo, id: 42 }
    const to = { type: 'reference', reference }
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied', from, to }] })
    await upsertRedirect(req as never, null, trigger, from)
    expect(req.payload.logger.debug).toHaveBeenCalledExactlyOnceWith({ from, to, trigger }, 'Removing redirect occupying a live product path')
    expect(req.payload.logger.debug.mock.invocationCallOrder[0]).toBeLessThan(req.payload.delete.mock.invocationCallOrder[0])
    expect(req.payload.logger.warn).not.toHaveBeenCalled()
    expect(req.payload.delete).toHaveBeenCalledTimes(1)
  })

  it('does not log when the destination has no redirect', async () => {
    const req = request()
    await upsertRedirect(req as never, null, { relationTo: 'products', id: 'p' }, '/products/new/tea')
    expect(req.payload.logger.warn).not.toHaveBeenCalled()
    expect(req.payload.logger.debug).not.toHaveBeenCalled()
    expect(req.payload.delete).not.toHaveBeenCalled()
  })

  it('upserts a reference, clearing a redirect on the occupied destination', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied' }] }).mockResolvedValueOnce({ docs: [{ id: 'old' }] })
    await upsertRedirect(req as never, '/products/old/tea', { relationTo: 'products', id: 'p' }, '/products/new/tea')
    expect(req.payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'redirects', id: 'occupied', req }))
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'redirects', id: 'old', data: { to: { type: 'reference', reference: { relationTo: 'products', value: 'p' } } }, req }))
  })

  it('clears an occupied destination even without an old URL and skips same-path redirect', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied' }] })
    await upsertRedirect(req as never, '/products/new/tea', { relationTo: 'products', id: 'p' }, '/products/new/tea')
    expect(req.payload.delete).toHaveBeenCalledTimes(1)
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('does no redirect queries or writes when republishing the same public path', async () => {
    const req = request()
    const doc = { id: 'p', slug: 'tea', categorySlug: 'green', _status: 'published' }
    await redirectProduct({ req, doc, previousDoc: { ...doc, title: 'Old content' } } as never)
    expect(req.payload.find).toHaveBeenCalledTimes(0)
    expect(req.payload.create).not.toHaveBeenCalled()
    expect(req.payload.update).not.toHaveBeenCalled()
    expect(req.payload.delete).not.toHaveBeenCalled()
  })

  it('clears an occupied path on first publication at the hook boundary', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied' }] })
    await redirectProduct({ req, doc: { id: 'p', slug: 'tea', categorySlug: 'green', _status: 'published' }, previousDoc: { id: 'p', _status: 'draft' } } as never)
    expect(req.payload.find).toHaveBeenCalledTimes(1)
    expect(req.payload.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'occupied', req }))
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('resolves the current reference path with the three-argument public helper', async () => {
    const req = request()
    await upsertRedirect(req as never, '/products/old', { relationTo: 'product-categories', id: 'c' })
    expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'product-categories', id: 'c', req }))
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: '/products/old' }) }))
  })

  it('writes only for published-to-published URL transitions and respects context', async () => {
    const req = request()
    const previousDoc = { id: 'p', slug: 'old', categorySlug: 'tea', _status: 'published' }
    const doc = { ...previousDoc, slug: 'new' }
    await redirectProduct({ req, doc, previousDoc } as never)
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: '/products/tea/old' }) }))
    req.payload.create.mockClear()
    await redirectProduct({ req, doc: { ...doc, _status: 'draft' }, previousDoc } as never)
    await redirectProduct({ req: { ...req, context: { skipProductRedirect: true } }, doc, previousDoc } as never)
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('redirects a published product moved to another category', async () => {
    const req = request()
    await redirectProduct({
      req,
      previousDoc: { id: 'p', slug: 'tea', categorySlug: 'green', _status: 'published' },
      doc: { id: 'p', slug: 'tea', categorySlug: 'black', _status: 'published' },
    } as never)
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ from: '/products/green/tea', to: { type: 'reference', reference: { relationTo: 'products', value: 'p' } } }),
    }))
  })

  it('propagates every page including drafts, retaining a trusted derived slug', async () => {
    const req = request()
    req.payload.find.mockImplementation(async ({ collection, draft, page }) => {
      if (collection !== 'products') return { docs: [], hasNextPage: false }
      if (!draft && page === 1) return { docs: [{ id: 'p1' }], hasNextPage: true }
      if (!draft) return { docs: [], hasNextPage: false }
      return { docs: [{ id: 'p2' }], hasNextPage: false }
    })
    req.payload.findByID.mockImplementation(async ({ id, draft }) => id === 'p1'
      ? { id, slug: 'one', category: 'c', _status: 'published' }
      : draft ? { id, slug: 'two', category: 'c', title: 'Unpublished edits', _status: 'draft' } : { id, slug: 'two', category: 'c', _status: 'draft' })
    await propagateCategorySlug({ req, doc: { id: 'c', slug: 'new' }, previousDoc: { id: 'c', slug: 'old' } } as never)
    expect(req.payload.find.mock.calls.filter(([args]) => args.collection === 'products')).toHaveLength(3)
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', draft: false, data: expect.objectContaining({ categorySlug: 'new', _status: 'published' }), context: expect.objectContaining({ disableRevalidate: true, skipProductRedirect: true }) }))
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2', draft: true, data: expect.objectContaining({ categorySlug: 'new', title: 'Unpublished edits', _status: 'draft' }) }))
    expect(revalidateTag).toHaveBeenCalledWith('product-p1', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('product-p2', 'max')
    const data = await setProductCategorySlug({ data: { categorySlug: 'new' }, originalDoc: { category: 'c', categorySlug: 'old' }, req: { ...req, context: { setDerivedCategorySlug: true } } } as never)
    expect(data.categorySlug).toBe('new')
  })

  it('preserves a newer draft of a published product during category rename', async () => {
    const req = request()
    req.payload.find.mockImplementation(async ({ collection }) => collection === 'products' ? { docs: [{ id: 'p' }], hasNextPage: false } : { docs: [], hasNextPage: false })
    req.payload.findByID.mockImplementation(async ({ draft }) => draft
      ? { id: 'p', slug: 'draft-slug', title: 'Draft title', category: 'c', categorySlug: 'old', _status: 'draft' }
      : { id: 'p', slug: 'public-slug', title: 'Public title', category: 'c', categorySlug: 'old', _status: 'published' })
    await propagateCategorySlug({ req, doc: { id: 'c', slug: 'new' }, previousDoc: { id: 'c', slug: 'old' } } as never)
    const productUpdates = req.payload.update.mock.calls.map(([args]) => args).filter((args) => args.collection === 'products')
    expect(productUpdates).toHaveLength(2)
    expect(productUpdates[0]).toMatchObject({ draft: false, data: { categorySlug: 'new' } })
    expect(productUpdates[1]).toMatchObject({ draft: true, data: { slug: 'draft-slug', title: 'Draft title', categorySlug: 'new', _status: 'draft' } })
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: '/products/old/public-slug' }) }))
  })
})
