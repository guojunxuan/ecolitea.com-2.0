import { describe, expect, it, vi } from 'vitest'
import { setProductCategorySlug } from '@/collections/Products/hooks/setProductCategorySlug'

const req = () => ({ context: {}, payload: { findByID: vi.fn().mockResolvedValue({ slug: 'green-tea' }) } })

describe('Product categorySlug maintenance', () => {
  it.each(['category-1', { id: 'category-1', slug: 'forged' }])(
    'fetches the category on create for relationship %s and overwrites spoofed input',
    async (category) => {
      const request = req()
      const data = { category, categorySlug: 'forged' }
      expect(
        await setProductCategorySlug({ data, operation: 'create', req: request } as never),
      ).toMatchObject({ categorySlug: 'green-tea' })
      expect(request.payload.findByID).toHaveBeenCalledWith({
        collection: 'product-categories',
        id: 'category-1',
        depth: 0,
        req: request,
      })
    },
  )

  it('fetches on category change and on missing cached slug', async () => {
    const request = req()
    const changed = await setProductCategorySlug({
      data: { category: 'category-2', categorySlug: 'forged' },
      originalDoc: { category: 'category-1', categorySlug: 'old' },
      operation: 'update',
      req: request,
    } as never)
    expect(changed.categorySlug).toBe('green-tea')
    expect(request.payload.findByID).toHaveBeenCalledWith({
      collection: 'product-categories',
      id: 'category-2',
      depth: 0,
      req: request,
    })
    request.payload.findByID.mockClear()
    const missing = await setProductCategorySlug({
      data: { category: { id: 'category-1' } },
      originalDoc: { category: 'category-1', categorySlug: null },
      operation: 'update',
      req: request,
    } as never)
    expect(missing.categorySlug).toBe('green-tea')
    expect(request.payload.findByID).toHaveBeenCalledTimes(1)
  })

  it('preserves the trusted cached slug without querying when the relationship is unchanged', async () => {
    const request = req()
    const originalDoc = { category: { id: 'category-1' }, categorySlug: 'original' }
    for (const data of [
      { category: 'category-1', categorySlug: 'forged' },
      { category: { id: 'category-1' }, categorySlug: 'forged' },
      { categorySlug: 'forged' },
    ]) {
      expect(
        await setProductCategorySlug({
          data,
          originalDoc,
          operation: 'update',
          req: request,
        } as never),
      ).toMatchObject({ categorySlug: 'original' })
    }
    expect(request.payload.findByID).not.toHaveBeenCalled()
  })
})
