import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
function installObserver() {
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
  return {
    trigger: () =>
      act(() =>
        intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver),
      ),
    disconnect,
  }
}
afterEach(() => {
  cleanup()
  navigation.push.mockReset()
  vi.unstubAllGlobals()
})
it('renders initial cards then appends unique cards and updates loaded range', async () => {
  const observer = installObserver()
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
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  observer.trigger()
  await screen.findByRole('link', { name: 'Blog two' })
  expect(screen.getAllByRole('link', { name: 'Blog one' })).toHaveLength(1)
  expect(fetcher.mock.calls[0][0]).toBe('/api/public-blog-list?page=2&category=tea')
  expect(screen.getByText('Showing 1 - 2 of 2 Blogs')).toBeTruthy()
  expect(screen.getByText("You've reached the end.")).toBeTruthy()
})
it('retains cards after failure and retries the same page', async () => {
  const observer = installObserver()
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ docs: [blog('two')], page: 2, totalDocs: 2, hasNextPage: false }),
    })
  vi.stubGlobal('fetch', fetcher)
  render(<BlogExplorer {...props} />)
  observer.trigger()
  await screen.findByText('Failed to load more blogs.')
  expect(screen.getByRole('link', { name: 'Blog one' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('link', { name: 'Blog two' })
  expect(fetcher.mock.calls[1][0]).toBe(fetcher.mock.calls[0][0])
})
it('aborts pending work and shows new route cards immediately', async () => {
  const observer = installObserver()
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { rerender } = render(<BlogExplorer {...props} />)
  observer.trigger()
  rerender(<BlogExplorer {...props} categoryId="other" initialBlogs={[blog('new')]} />)
  expect(screen.queryByRole('link', { name: 'Blog one' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Blog new' })).toBeTruthy()
  await waitFor(() => expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true))
})
it('loads from the observer and locks overlapping requests without visible pagination', async () => {
  const observer = installObserver()
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => new Promise(() => {})),
  )
  const { unmount } = render(<BlogExplorer {...props} />)
  expect(screen.queryByRole('link', { name: 'Go to next page' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  observer.trigger()
  observer.trigger()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status').textContent).toBe('Loading more blogs…')
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
  unmount()
  expect(signal?.aborted).toBe(true)
  expect(observer.disconnect).toHaveBeenCalled()
})
it('shows an empty state without requesting a nonexistent next page', () => {
  vi.stubGlobal('fetch', vi.fn())
  render(<BlogExplorer {...props} initialBlogs={[]} totalDocs={0} totalPages={0} />)
  expect(screen.getByText('No blogs found.')).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('refreshes same-ID content and cancels pending work from the old server snapshot', async () => {
  const observer = installObserver()
  const fetcher = vi.fn().mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { rerender } = render(<BlogExplorer {...props} />)
  observer.trigger()
  rerender(
    <BlogExplorer
      {...props}
      initialBlogs={[{ ...blog('one'), title: 'Updated title', excerpt: 'Updated excerpt' }]}
    />,
  )
  expect(screen.getByRole('link', { name: 'Updated title' })).toBeTruthy()
  expect(screen.getByText('Updated excerpt')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Blog one' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  await waitFor(() => expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true))
})
