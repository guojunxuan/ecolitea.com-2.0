import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

const { find } = vi.hoisted(() => ({ find: vi.fn() }))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ find }),
}))
vi.mock('@/search/Component', () => ({ Search: () => <input aria-label="Search" /> }))
vi.mock('@/components/Media', () => ({ Media: () => <div /> }))
vi.mock('@/utilities/useClickableCard', () => ({
  default: () => ({ cardRef: { current: null }, linkRef: { current: null } }),
}))

import SearchPage from '@/app/(frontend)/search/page'

describe('site search results', () => {
  it('links Blog results to Blogs and Post results to Posts', async () => {
    find.mockResolvedValue({
      totalDocs: 2,
      docs: [
        {
          title: 'Tea Notes', slug: 'tea-notes', excerpt: 'An oolong guide', heroImage: 'image-1',
          meta: { description: 'Custom SEO summary without the excerpt term' },
          category: { title: 'Brewing', slug: 'brewing' },
          doc: { relationTo: 'blogs', value: 'blog-1' },
        },
        {
          title: 'News', slug: 'news', categories: [], meta: { description: 'Latest' },
          doc: { relationTo: 'posts', value: 'post-1' },
        },
      ],
    })

    render(await SearchPage({ searchParams: Promise.resolve({ q: 'oolong' }) }))

    expect(screen.getByRole('link', { name: 'Tea Notes' }).getAttribute('href')).toBe('/blogs/tea-notes')
    expect(screen.getByRole('link', { name: 'News' }).getAttribute('href')).toBe('/posts/news')
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'search', overrideAccess: false,
      select: expect.objectContaining({ doc: true, excerpt: true, category: true, heroImage: true }),
      where: expect.objectContaining({ and: expect.arrayContaining([
        expect.objectContaining({ or: expect.arrayContaining([
          { excerpt: { like: 'oolong' } },
        ]) }),
        expect.objectContaining({ or: expect.arrayContaining([
          expect.objectContaining({ and: expect.arrayContaining([
            { blogStatus: { equals: 'published' } },
            expect.objectContaining({ publishedAt: expect.objectContaining({ less_than_equal: expect.any(String) }) }),
          ]) }),
        ]) }),
      ]) }),
    }))
  })

  it('also applies Blog visibility when no query is entered', async () => {
    find.mockResolvedValue({ totalDocs: 0, docs: [] })
    render(await SearchPage({ searchParams: Promise.resolve({}) }))
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ or: expect.arrayContaining([
        expect.objectContaining({ and: expect.arrayContaining([
          { blogStatus: { equals: 'published' } },
          expect.objectContaining({ publishedAt: expect.objectContaining({ less_than_equal: expect.any(String) }) }),
        ]) }),
      ]) }),
    }))
  })
})
