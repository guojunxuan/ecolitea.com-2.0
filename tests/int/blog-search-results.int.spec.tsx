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
          title: 'Tea Notes', slug: 'tea-notes', excerpt: 'A guide', heroImage: 'image-1',
          category: { title: 'Brewing', slug: 'brewing' },
          doc: { relationTo: 'blogs', value: 'blog-1' },
        },
        {
          title: 'News', slug: 'news', categories: [], meta: { description: 'Latest' },
          doc: { relationTo: 'posts', value: 'post-1' },
        },
      ],
    })

    render(await SearchPage({ searchParams: Promise.resolve({ q: 'tea' }) }))

    expect(screen.getByRole('link', { name: 'Tea Notes' }).getAttribute('href')).toBe('/blogs/tea-notes')
    expect(screen.getByRole('link', { name: 'News' }).getAttribute('href')).toBe('/posts/news')
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'search', select: expect.objectContaining({ doc: true, excerpt: true, category: true, heroImage: true }),
    }))
  })
})
