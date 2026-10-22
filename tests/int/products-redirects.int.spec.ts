import { describe, expect, it, vi } from 'vitest'
import { revalidateTag } from 'next/cache'
import { setProductCategorySlug } from '@/collections/Products/hooks/setProductCategorySlug'
import { upsertRedirect, redirectProduct } from '@/collections/Products/hooks/productRedirects'
import { propagateCategorySlug } from '@/collections/Products/hooks/propagateCategorySlug'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const request = () => ({
  context: {},
  payload: {
    find: vi.fn().mockResolvedValue({ docs: [], hasNextPage: false }),
    findByID: vi.fn().mockResolvedValue({ slug: 'new' }),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
})

describe('product redirects', () => {
  it('upserts a 301 reference, clearing a redirect on the occupied destination', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied' }] }).mockResolvedValueOnce({ docs: [{ id: 'old' }] })
    await upsertRedirect(req as never, '/products/old/tea', '/products/new/tea', { relationTo: 'products', id: 'p' })
    expect(req.payload.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'redirects', id: 'occupied', req }))
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'redirects', id: 'old', data: { to: { type: 'reference', reference: { relationTo: 'products', value: 'p' } }, type: '301' }, req }))
  })

  it('clears an occupied destination even without an old URL and skips same-path redirect', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'occupied' }] })
    await upsertRedirect(req as never, '/products/new/tea', '/products/new/tea', { relationTo: 'products', id: 'p' })
    expect(req.payload.delete).toHaveBeenCalledTimes(1)
    expect(req.payload.create).not.toHaveBeenCalled()
  })

  it('writes only for published-to-published URL transitions and respects context', async () => {
    const req = request()
    const previousDoc = { id: 'p', slug: 'old', categorySlug: 'tea', _status: 'published' }
    const doc = { ...previousDoc, slug: 'new' }
    await redirectProduct({ req, doc, previousDoc } as never)
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: '/products/tea/old', type: '301' }) }))
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
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'p1', slug: 'one', _status: 'published' }], hasNextPage: true }).mockResolvedValueOnce({ docs: [{ id: 'p2', slug: 'two', title: 'Unpublished edits', _status: 'draft' }], hasNextPage: false })
    req.payload.findByID.mockImplementation(async ({ id }) => id === 'p1' ? { id, slug: 'one', _status: 'published' } : { id, slug: 'two', _status: 'draft' })
    await propagateCategorySlug({ req, doc: { id: 'c', slug: 'new' }, previousDoc: { id: 'c', slug: 'old' } } as never)
    expect(req.payload.find.mock.calls.filter(([args]) => args.collection === 'products')).toHaveLength(2)
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', draft: false, data: expect.objectContaining({ categorySlug: 'new', _status: 'published' }), context: expect.objectContaining({ disableRevalidate: true, skipProductRedirect: true }) }))
    expect(req.payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2', draft: true, data: expect.objectContaining({ categorySlug: 'new', title: 'Unpublished edits', _status: 'draft' }) }))
    expect(revalidateTag).toHaveBeenCalledWith('product-p1', 'max')
    expect(revalidateTag).toHaveBeenCalledWith('product-p2', 'max')
    const data = await setProductCategorySlug({ data: { categorySlug: 'new' }, originalDoc: { category: 'c', categorySlug: 'old' }, req: { ...req, context: { setDerivedCategorySlug: true } } } as never)
    expect(data.categorySlug).toBe('new')
  })

  it('preserves a newer draft of a published product during category rename', async () => {
    const req = request()
    req.payload.find.mockResolvedValueOnce({ docs: [{ id: 'p', slug: 'draft-slug', title: 'Draft title', _status: 'draft' }], hasNextPage: false })
    req.payload.findByID.mockResolvedValue({ id: 'p', slug: 'public-slug', title: 'Public title', categorySlug: 'old', _status: 'published' })
    await propagateCategorySlug({ req, doc: { id: 'c', slug: 'new' }, previousDoc: { id: 'c', slug: 'old' } } as never)
    const productUpdates = req.payload.update.mock.calls.map(([args]) => args).filter((args) => args.collection === 'products')
    expect(productUpdates).toHaveLength(2)
    expect(productUpdates[0]).toMatchObject({ draft: false, data: { categorySlug: 'new' } })
    expect(productUpdates[1]).toMatchObject({ draft: true, data: { slug: 'draft-slug', title: 'Draft title', categorySlug: 'new', _status: 'draft' } })
    expect(req.payload.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ from: '/products/old/public-slug' }) }))
  })
})
