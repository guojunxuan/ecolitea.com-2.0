import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BlogExplorer } from '@/components/BlogExplorer'
import type { BlogListItem } from '@/utilities/blogs/getBlogListing'
const navigation = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
}))
vi.mock('@/components/Media', () => ({ Media: () => null }))
const blog = (id: string): BlogListItem => ({
  id,
  title: `Blog ${id}`,
  slug: id,
  heroImage: 'media',
  category: 'tea',
  excerpt: '',
  publishedAt: '2026-10-01',
})
const props = {
  initialBlogs: [blog('one')],
  initialPage: 1,
  totalPages: 2,
  totalDocs: 2,
  categoryId: 'tea',
}
afterEach(() => {
  cleanup()
  navigation.push.mockReset()
  vi.unstubAllGlobals()
})
it('renders initial cards then appends unique cards and updates loaded range', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      docs: [blog('one'), blog('two')],
      page: 2,
      totalDocs: 2,
      hasNextPage: false,
    }),
  })
  vi.stubGlobal('fetch', fetcher)
  render(<BlogExplorer {...props} />)
  expect(screen.getByRole('link', { name: 'Blog one' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByRole('link', { name: 'Blog two' })
  expect(screen.getAllByRole('link', { name: 'Blog one' })).toHaveLength(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/public-blog-list?page=2&category=tea')
  expect(screen.getByText('Showing 1 - 2 of 2 Blogs')).toBeTruthy()
  expect(screen.getByText("You've reached the end.")).toBeTruthy()
})
it('retains cards after failure and retries the same page', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [blog('two')], page: 2, totalDocs: 2, hasNextPage: false }),
    })
  vi.stubGlobal('fetch', fetcher)
  render(<BlogExplorer {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByText('Failed to load more blogs.')
  expect(screen.getByRole('link', { name: 'Blog one' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('link', { name: 'Blog two' })
  expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[0][0])
})
it('aborts pending work and shows new route cards immediately', async () => {
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { rerender } = render(<BlogExplorer {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  rerender(<BlogExplorer {...props} categoryId="other" initialBlogs={[blog('new')]} />)
  expect(screen.queryByRole('link', { name: 'Blog one' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Blog new' })).toBeTruthy()
  await waitFor(() => expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true))
})
it('loads from the observer and locks overlapping manual requests', async () => {
  let intersect: IntersectionObserverCallback = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = callback
      }
      observe() {}
      disconnect() {
        disconnect()
      }
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => new Promise(() => {})),
  )
  const { unmount } = render(<BlogExplorer {...props} />)
  const { act } = await import('@testing-library/react')
  act(() => {
    intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver)
    intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver)
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status').textContent).toBe('Loading more blogs…')
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
  unmount()
  expect(signal?.aborted).toBe(true)
  expect(disconnect).toHaveBeenCalled()
})
it('shows an empty state without requesting a nonexistent next page', () => {
  vi.stubGlobal('fetch', vi.fn())
  render(<BlogExplorer {...props} initialBlogs={[]} totalDocs={0} totalPages={0} />)
  expect(screen.getByText('No blogs found.')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('refreshes same-ID content and cancels pending work from the old server snapshot', async () => {
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { rerender } = render(<BlogExplorer {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  rerender(
    <BlogExplorer
      {...props}
      initialBlogs={[{ ...blog('one'), title: 'Updated title', excerpt: 'Updated excerpt' }]}
    />,
  )
  expect(screen.getByRole('link', { name: 'Updated title' })).toBeTruthy()
  expect(screen.getByText('Updated excerpt')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Blog one' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Load more' })).toBeTruthy()
  await waitFor(() => expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true))
})

it('renders server-filtered results and keeps filters on load more', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const fetcher = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ docs: [blog('next')], page: 2, totalDocs: 2, hasNextPage: false }),
  })
  vi.stubGlobal('fetch', fetcher)
  render(
    <BlogExplorer
      {...props}
      initialBlogs={[blog('filtered')]}
      initialQuery="author=a&author=b&dateRange=30d&sort=oldest"
      categories={[{ id: 'tea', slug: 'tea-guides', title: 'Tea', count: 2 }]}
      authors={[
        { id: 'a', name: 'Author A' },
        { id: 'b', name: 'Author B' },
      ]}
      routeBase="/blogs/category/tea-guides"
    />,
  )
  expect(screen.getByRole('link', { name: 'Blog filtered' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Blog one' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Go to next page' })).toBeNull()
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  await screen.findByRole('link', { name: 'Blog next' })
  expect(fetcher.mock.calls[0][0]).toContain(
    'page=2&category=tea&author=a&author=b&dateRange=30d&sort=oldest',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reset all' }))
  expect(navigation.push).toHaveBeenLastCalledWith('/blogs')
})

it('aborts an earlier page request when a new server filter snapshot arrives', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  let resolveOld: (response: unknown) => void = () => {}
  const fetcher = vi.fn().mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve
      }),
  )
  vi.stubGlobal('fetch', fetcher)
  const categories = [{ id: 'tea', slug: 'tea', title: 'Tea', count: 2 }]
  const { rerender } = render(
    <BlogExplorer {...props} initialQuery="sort=oldest" categories={categories} />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  const oldSignal = fetcher.mock.calls[0][1].signal as AbortSignal
  rerender(
    <BlogExplorer
      {...props}
      initialBlogs={[blog('new-filter')]}
      initialQuery="sort=title-desc"
      categories={categories}
    />,
  )
  expect(screen.getByRole('link', { name: 'Blog new-filter' })).toBeTruthy()
  expect(oldSignal.aborted).toBe(true)
  resolveOld({
    ok: true,
    json: async () => ({ docs: [blog('stale')], page: 1, totalDocs: 1, hasNextPage: false }),
  })
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Blog stale' })).toBeNull())
})
