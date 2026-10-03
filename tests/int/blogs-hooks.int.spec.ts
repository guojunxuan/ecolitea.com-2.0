import { beforeEach, describe, expect, it, vi } from 'vitest'
import { revalidatePath, revalidateTag } from 'next/cache'
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

beforeEach(() => vi.clearAllMocks())

describe('Blog cache invalidation', () => {
  const req = {
    context: {},
    payload: { findByID: vi.fn(async ({ id }) => ({ id, slug: `category-${id}` })) },
  }
  it('invalidates old/new published detail and category paths plus every listing cache', async () => {
    const { revalidateBlog } = await import('@/collections/Blogs/hooks/revalidateBlog')
    await revalidateBlog({
      req,
      doc: { id: 'b', slug: 'new', category: 'new', _status: 'published' },
      previousDoc: { id: 'b', slug: 'old', category: 'old', _status: 'published' },
    } as never)
    for (const path of [
      '/blogs/new',
      '/blogs/old',
      '/blogs',
      '/blogs/category/category-new',
      '/blogs/category/category-old',
      '/search',
    ])
      expect(revalidatePath).toHaveBeenCalledWith(path)
    for (const tag of [
      'blogs-list',
      'blogs-sitemap',
      'blog-b',
      'blog-category-new',
      'blog-category-old',
    ])
      expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
  })
  it('invalidates unpublish and delete, while skipping draft-only writes and disabled hooks', async () => {
    const { revalidateBlog, revalidateDelete } =
      await import('@/collections/Blogs/hooks/revalidateBlog')
    await revalidateBlog({
      req,
      doc: { slug: 'draft', _status: 'draft' },
      previousDoc: { slug: 'draft', _status: 'draft' },
    } as never)
    await revalidateDelete({ req, doc: { slug: 'draft', _status: 'draft' } } as never)
    await revalidateBlog({
      req: { ...req, context: { disableRevalidate: true } },
      doc: { slug: 'published', _status: 'published' },
    } as never)
    expect(revalidatePath).not.toHaveBeenCalled()
    await revalidateBlog({
      req,
      doc: { id: 'b', slug: 'draft', _status: 'draft' },
      previousDoc: { id: 'b', slug: 'old', category: 'old', _status: 'published' },
    } as never)
    expect(revalidatePath).toHaveBeenCalledWith('/blogs/old')
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
    vi.clearAllMocks()
    await revalidateDelete({
      req,
      doc: { id: 'b', slug: 'deleted', category: 'old', _status: 'published' },
    } as never)
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
    expect(revalidatePath).toHaveBeenCalledWith('/blogs/deleted')
    expect(revalidateTag).toHaveBeenCalledWith('blogs-list', 'max')
  })
  it('does not expire redirects for ordinary published content edits', async () => {
    const { revalidateBlog } = await import('@/collections/Blogs/hooks/revalidateBlog')
    const doc = {
      id: 'b',
      slug: 'same',
      category: 'cat',
      _status: 'published',
      publishedAt: '2025-01-01T00:00:00.000Z',
    }
    await revalidateBlog({
      req,
      previousDoc: { ...doc, title: 'Old' },
      doc: { ...doc, title: 'New' },
    } as never)
    expect(revalidateTag).not.toHaveBeenCalledWith('redirects', expect.anything())
  })
  it('invalidates category tabs, old/new paths, list caches, and sitemap on updates/order/delete', async () => {
    const { BlogCategories } = await import('@/collections/BlogCategories')
    await BlogCategories.hooks!.afterChange![0]({
      req,
      doc: { id: 'c', slug: 'new' },
      previousDoc: { id: 'c', slug: 'old' },
    } as never)
    expect(revalidatePath).toHaveBeenCalledWith('/blogs/category/new')
    expect(revalidatePath).toHaveBeenCalledWith('/blogs/category/old')
    for (const tag of ['blog-categories', 'blogs-list', 'blogs-sitemap'])
      expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    vi.clearAllMocks()
    await BlogCategories.hooks!.afterDelete![0]({ req, doc: { id: 'c', slug: 'new' } } as never)
    expect(revalidatePath).toHaveBeenCalledWith('/blogs/category/new')
    expect(revalidateTag).toHaveBeenCalledWith('blogs-sitemap', 'max')
  })
})

describe('Blog author projection', () => {
  it('omits a missing author and keeps remaining authors', async () => {
    const { populateAuthors } = await import('@/collections/Blogs/hooks/populateAuthors')
    const findByID = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u', name: 'Author' })
    const req = { payload: { findByID } }
    const doc = await populateAuthors({ req, doc: { authors: ['deleted', 'u'] } } as never)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'deleted', disableErrors: true }),
    )
    expect(doc.populatedAuthors).toEqual([{ id: 'u', name: 'Author' }])
  })

  it('propagates unexpected author lookup failures', async () => {
    const { populateAuthors } = await import('@/collections/Blogs/hooks/populateAuthors')
    const failure = new Error('Database transaction failed')
    const req = { payload: { findByID: vi.fn().mockRejectedValue(failure) } }
    await expect(populateAuthors({ req, doc: { authors: ['u'] } } as never)).rejects.toBe(failure)
  })

  it('queries only public identity fields, propagates req, and clears stale author data', async () => {
    const { populateAuthors } = await import('@/collections/Blogs/hooks/populateAuthors')
    const findByID = vi
      .fn()
      .mockResolvedValue({ id: 'u', name: 'Author', email: 'private@example.test' })
    const req = { payload: { findByID } }
    const doc = await populateAuthors({ req, doc: { authors: ['u'] } } as never)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 'u',
        req,
        select: { id: true, name: true },
        depth: 0,
      }),
    )
    expect(doc.populatedAuthors).toEqual([{ id: 'u', name: 'Author' }])
    const empty = await populateAuthors({
      req,
      doc: { authors: [], populatedAuthors: [{ id: 'stale', name: 'Old' }] },
    } as never)
    expect(empty.populatedAuthors).toEqual([])
  })
})
