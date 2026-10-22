import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
import { revalidateProduct, revalidateProductDelete } from '@/collections/Products/hooks/revalidateProduct'
import { revalidateProductCategory, revalidateProductCategoryDelete } from '@/collections/ProductCategories/hooks/revalidateProductCategory'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
beforeEach(() => vi.clearAllMocks())

describe('product cache invalidation', () => {
  it('covers old and new paths, category IDs, and shared tags', async () => {
    const req = { context: {} }
    await revalidateProduct({ req, doc: { id: 'p', slug: 'new', categorySlug: 'new-cat', category: 'c2', _status: 'published' }, previousDoc: { id: 'p', slug: 'old', categorySlug: 'old-cat', category: 'c1', _status: 'published' } } as never)
    for (const path of ['/products/new-cat/new', '/products/old-cat/old', '/products/new-cat', '/products/old-cat']) expect(revalidatePath).toHaveBeenCalledWith(path)
    for (const tag of ['product-p', 'products-list', 'products-overview', 'product-category-c1', 'product-category-c2', 'products-sitemap']) expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
    vi.clearAllMocks()
    await revalidateProductDelete({ req, doc: { id: 'p', slug: 'old', categorySlug: 'old-cat', category: 'c1', _status: 'published' } } as never)
    expect(revalidateTag).toHaveBeenCalledWith('product-p', 'max')
  })

  it('covers category rename/delete and skips disabled or draft-only product changes', async () => {
    const req = { context: {} }
    await revalidateProductCategory({ req, doc: { id: 'c', slug: 'new' }, previousDoc: { id: 'c', slug: 'old' } } as never)
    for (const path of ['/products/new', '/products/old', '/products']) expect(revalidatePath).toHaveBeenCalledWith(path)
    for (const tag of ['product-categories', 'products-overview', 'products-list', 'products-sitemap']) expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
    vi.clearAllMocks()
    await revalidateProductCategoryDelete({ req, doc: { id: 'c', slug: 'old' } } as never)
    expect(revalidatePath).toHaveBeenCalledWith('/products/old')
    vi.clearAllMocks()
    await revalidateProduct({ req, doc: { _status: 'draft' }, previousDoc: { _status: 'draft' } } as never)
    await revalidateProductCategory({ req: { context: { disableRevalidate: true } }, doc: { id: 'c', slug: 'new' } } as never)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
