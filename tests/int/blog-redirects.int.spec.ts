import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirects, findByID, redirect, permanentRedirect } = vi.hoisted(() => ({
  redirects: vi.fn(),
  findByID: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('TEMPORARY_REDIRECT')
  }),
  permanentRedirect: vi.fn(() => {
    throw new Error('PERMANENT_REDIRECT')
  }),
}))

vi.mock('@/utilities/getRedirects', () => ({ getCachedRedirects: () => redirects }))
vi.mock('@/utilities/getDocument', () => ({
  getCachedDocument: () => async () => ({ slug: 'old' }),
}))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ findByID }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  redirect,
  permanentRedirect,
}))

import { PayloadRedirects } from '@/components/PayloadRedirects'

beforeEach(() => {
  redirects.mockReset()
  findByID.mockReset()
  redirect.mockClear()
  permanentRedirect.mockClear()
})

describe('PayloadRedirects', () => {
  it('permanently redirects to a populated Blog reference', async () => {
    redirects.mockResolvedValue([
      {
        from: '/old-blog',
        to: { reference: { relationTo: 'blogs', value: { id: 'blog-123', slug: 'tea-notes' } } },
      },
    ])
    findByID.mockResolvedValue({ slug: 'tea-notes' })
    await expect(PayloadRedirects({ url: '/old-blog' })).rejects.toThrow('PERMANENT_REDIRECT')
    expect(permanentRedirect).toHaveBeenCalledWith('/blogs/tea-notes')
  })

  it('looks up a string Blog reference by ID before redirecting permanently', async () => {
    redirects.mockResolvedValue([
      {
        from: '/old-blog',
        to: { reference: { relationTo: 'blogs', value: 'blog-123' } },
      },
    ])
    findByID.mockResolvedValue({ slug: 'tea-notes' })
    await expect(PayloadRedirects({ url: '/old-blog' })).rejects.toThrow('PERMANENT_REDIRECT')
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'blogs', id: 'blog-123' }),
    )
    expect(permanentRedirect).toHaveBeenCalledWith('/blogs/tea-notes')
  })

  it('resolves the latest Blog slug while the populated redirect cache stays warm', async () => {
    const cached = [
      {
        from: '/old-blog',
        to: { reference: { relationTo: 'blogs', value: { id: 'blog-123', slug: 'tea-notes' } } },
      },
    ]
    redirects.mockResolvedValue(cached)
    findByID
      .mockResolvedValueOnce({ slug: 'tea-notes' })
      .mockResolvedValueOnce({ slug: 'renamed-tea' })
    await expect(PayloadRedirects({ url: '/old-blog' })).rejects.toThrow('PERMANENT_REDIRECT')
    expect(permanentRedirect).toHaveBeenLastCalledWith('/blogs/tea-notes')
    await expect(PayloadRedirects({ url: '/old-blog' })).rejects.toThrow('PERMANENT_REDIRECT')
    expect(permanentRedirect).toHaveBeenLastCalledWith('/blogs/renamed-tea')
  })

  it('keeps explicit URLs and Post destinations temporary', async () => {
    redirects.mockResolvedValue([{ from: '/external', to: { url: 'https://example.test' } }])
    await expect(PayloadRedirects({ url: '/external' })).rejects.toThrow('TEMPORARY_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('https://example.test')
    expect(permanentRedirect).not.toHaveBeenCalled()

    redirects.mockResolvedValue([
      {
        from: '/old-post',
        to: { reference: { relationTo: 'posts', value: { slug: 'news' } } },
      },
    ])
    await expect(PayloadRedirects({ url: '/old-post' })).rejects.toThrow('TEMPORARY_REDIRECT')
    expect(redirect).toHaveBeenLastCalledWith('/posts/news')
    expect(permanentRedirect).not.toHaveBeenCalled()
  })
})
