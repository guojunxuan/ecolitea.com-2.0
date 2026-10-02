import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BlogCategoryTabs } from '@/components/BlogCategoryTabs'
import { Card } from '@/components/Card'
import { CollectionArchive } from '@/components/CollectionArchive'
import { PageRange } from '@/components/PageRange'
import { Pagination } from '@/components/Pagination'
import type { Blog, Post } from '@/payload-types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/components/Media', () => ({
  Media: ({ resource }: { resource: { alt?: string } }) => (
    <span data-testid="card-media">{resource.alt}</span>
  ),
}))

const blog = {
  id: 'blog-1',
  slug: 'organic-tea',
  title: 'Organic Tea',
  heroImage: { id: 'media-1', alt: 'Tea leaves', mimeType: 'image/jpeg', url: '/tea.jpg' },
  excerpt: 'A better cup of tea.',
  category: { id: 'category-1', title: 'Tea Guides', slug: 'tea-guides' },
  publishedAt: '2026-09-28T10:00:00.000Z',
} as Blog

const post = {
  slug: 'existing-post',
  title: 'Existing Post',
  meta: { description: 'Post summary' },
  categories: [{ title: 'News' }],
} as Post

afterEach(() => {
  cleanup()
  push.mockReset()
})

describe('blog listing components', () => {
  it('preserves the post card URL and summary', () => {
    render(<Card doc={post} relationTo="posts" showCategories />)
    expect(screen.getByRole('link', { name: 'Existing Post' }).getAttribute('href')).toBe(
      '/posts/existing-post',
    )
    expect(screen.getByText('Post summary')).toBeTruthy()
    expect(screen.getByText('News')).toBeTruthy()
  })

  it('renders blog media, excerpt, one linked category and published date', () => {
    render(<Card doc={blog} relationTo="blogs" />)
    expect(screen.getByRole('link', { name: 'Organic Tea' }).getAttribute('href')).toBe(
      '/blogs/organic-tea',
    )
    expect(screen.getByTestId('card-media').textContent).toBe('Tea leaves')
    expect(screen.getByText('A better cup of tea.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tea Guides' }).getAttribute('href')).toBe(
      '/blogs/category/tea-guides',
    )
    expect(screen.getByText('Sep 28, 2026').closest('time')?.getAttribute('dateTime')).toBe(
      '2026-09-28',
    )
  })

  it('features only the first blog card when the caller requests it', () => {
    const blogs = [blog, { ...blog, id: 'blog-2', slug: 'second-blog', title: 'Second Blog' }]
    const { container, rerender } = render(
      <CollectionArchive posts={blogs} relationTo="blogs" featuredFirst />,
    )
    const items = container.querySelectorAll('[data-slot="archive-item"]')
    expect(items[0]?.getAttribute('data-featured')).toBe('true')
    expect(items[1]?.getAttribute('data-featured')).toBeNull()

    rerender(<CollectionArchive posts={blogs} relationTo="blogs" />)
    expect(container.querySelector('[data-featured]')).toBeNull()
  })

  it('renders populated category links and a mobile More control', () => {
    render(
      <BlogCategoryTabs
        categories={[
          { id: 'tea', title: 'Tea Guides', slug: 'tea-guides', count: 3 },
          { id: 'life', title: 'Lifestyle', slug: 'lifestyle', count: 2 },
          { id: 'news', title: 'News', slug: 'news', count: 1 },
          { id: 'empty', title: 'Empty', slug: 'empty', count: 0 },
        ]}
        currentCategory="tea-guides"
      />,
    )
    const navigation = screen.getByRole('navigation', { name: 'Blog categories' })
    expect(within(navigation).getAllByRole('link', { name: /All/ })[0]?.getAttribute('href')).toBe('/blogs')
    expect(within(navigation).getAllByRole('link', { name: /Tea Guides/ })[0]?.getAttribute('href')).toBe(
      '/blogs/category/tea-guides',
    )
    expect(within(navigation).getAllByRole('link', { name: /Tea Guides/ })[0]?.getAttribute('aria-current')).toBe(
      'page',
    )
    expect(within(navigation).queryByText('Empty')).toBeNull()
    fireEvent.click(within(navigation).getByText('More categories'))
    expect(within(navigation).getAllByRole('link', { name: /News/ }).length).toBeGreaterThan(1)
  })

  it('uses the requested pagination base while preserving posts by default', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} routeBase="/blogs" />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(push).toHaveBeenLastCalledWith('/blogs/page/2')

    rerender(<Pagination page={1} totalPages={3} routeBase="/blogs/category/tea" />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(push).toHaveBeenLastCalledWith('/blogs/category/tea/page/2')

    rerender(<Pagination page={1} totalPages={3} />)
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(push).toHaveBeenLastCalledWith('/posts/page/2')
  })

  it('labels blog result counts', () => {
    render(<PageRange collection="blogs" currentPage={1} limit={12} totalDocs={20} />)
    expect(screen.getByText('Showing 1 - 12 of 20 Blogs')).toBeTruthy()
  })
})
