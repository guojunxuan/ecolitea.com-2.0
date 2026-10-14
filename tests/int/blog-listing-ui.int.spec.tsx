import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BlogCategoryTabs } from '@/components/BlogCategoryTabs'
import { Card } from '@/components/Card'
import { CollectionArchive } from '@/components/CollectionArchive'
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
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('href') === '/blogs/organic-tea'),
    ).toHaveLength(1)
    expect(screen.getByTestId('card-media').textContent).toBe('Tea leaves')
    expect(screen.getByText('A better cup of tea.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tea Guides' }).getAttribute('href')).toBe(
      '/blogs/category/tea-guides',
    )
    expect(screen.getByText('Sep 28, 2026').closest('time')?.getAttribute('dateTime')).toBe(
      '2026-09-28',
    )
  })

  it('renders every blog card as a uniform grid item', () => {
    const blogs = [blog, { ...blog, id: 'blog-2', slug: 'second-blog', title: 'Second Blog' }]
    const { container } = render(<CollectionArchive posts={blogs} relationTo="blogs" />)
    expect(container.querySelectorAll('[data-slot="archive-item"]')).toHaveLength(2)
    expect(container.querySelector('[data-featured]')).toBeNull()
  })

  it('keeps all populated categories accessible in the mobile dropdown', () => {
    const { rerender } = render(
      <BlogCategoryTabs
        categories={[
          { id: 'tea', title: 'Tea Guides', slug: 'tea-guides', count: 3 },
          { id: 'life', title: 'Lifestyle', slug: 'lifestyle', count: 2 },
          { id: 'news', title: 'News', slug: 'news', count: 1 },
          { id: 'empty', title: 'Empty', slug: 'empty', count: 0 },
        ]}
        currentCategory="news"
      />,
    )
    const navigation = screen.getByRole('navigation', { name: 'Blog categories' })
    expect(within(navigation).getAllByRole('link', { name: /All/ })[0]?.getAttribute('href')).toBe('/blogs')
    expect(within(navigation).getAllByRole('link', { name: /Tea Guides/ })[0]?.getAttribute('href')).toBe(
      '/blogs/category/tea-guides',
    )
    expect(within(navigation).getAllByRole('link', { name: /News/ })[0]?.getAttribute('aria-current')).toBe(
      'page',
    )
    expect(within(navigation).queryByText('Empty')).toBeNull()
    const menu = navigation.querySelector<HTMLDetailsElement>('[data-slot="blog-mobile-menu"]')!
    expect(menu.open).toBe(false)
    const trigger = menu.querySelector('summary')!
    expect(trigger.textContent).toBe('News')
    fireEvent.click(trigger)
    expect(menu.open).toBe(true)
    expect(menu.querySelector('a[aria-current="page"]')?.textContent).toBe('News')
    expect(within(menu).getByRole('link', { name: 'Lifestyle' }).getAttribute('href')).toBe(
      '/blogs/category/lifestyle',
    )

    rerender(
      <BlogCategoryTabs categories={[{ id: 'tea', title: 'Tea Guides', slug: 'tea-guides', count: 3 }]} />,
    )
    expect(menu.querySelector('summary')?.textContent).toBe('All')
    expect(menu.querySelector('a[aria-current="page"]')?.textContent).toBe('All')
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

  it('navigates from blog page two to each canonical first page without changing Posts', () => {
    const { rerender } = render(
      <Pagination page={2} totalPages={3} routeBase="/blogs" firstPageHref="/blogs" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }))
    expect(push).toHaveBeenLastCalledWith('/blogs')
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    expect(push).toHaveBeenLastCalledWith('/blogs')

    rerender(<Pagination page={2} totalPages={3} routeBase="/blogs/category/tea" firstPageHref="/blogs/category/tea" />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }))
    expect(push).toHaveBeenLastCalledWith('/blogs/category/tea')

    rerender(<Pagination page={2} totalPages={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }))
    expect(push).toHaveBeenLastCalledWith('/posts/page/1')
  })

  it('renders canonical blog pagination links for navigation without JavaScript', () => {
    render(<Pagination linkMode page={2} totalPages={3} routeBase="/blogs" firstPageHref="/blogs" />)
    expect(screen.getByRole('link', { name: 'Go to previous page' }).getAttribute('href')).toBe('/blogs')
    expect(screen.getByRole('link', { name: '3' }).getAttribute('href')).toBe('/blogs/page/3')
    expect(screen.getByRole('link', { name: '2' }).getAttribute('aria-current')).toBe('page')
  })

  it('keeps the first and last blog pages reachable around the current page', () => {
    render(<Pagination linkMode page={5} totalPages={10} routeBase="/blogs" firstPageHref="/blogs" />)
    const pages = screen
      .getAllByRole('link')
      .filter((link) => !link.getAttribute('aria-label'))
      .map((link) => [link.textContent, link.getAttribute('href')])
    expect(pages).toEqual([
      ['1', '/blogs'],
      ['4', '/blogs/page/4'],
      ['5', '/blogs/page/5'],
      ['6', '/blogs/page/6'],
      ['10', '/blogs/page/10'],
    ])
    expect(screen.getAllByText('More pages')).toHaveLength(2)
  })

})
