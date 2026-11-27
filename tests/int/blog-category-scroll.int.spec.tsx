import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BlogCategoryTabs } from '@/components/BlogCategoryTabs'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ scroll, ...props }: React.ComponentProps<'a'> & { scroll?: boolean }) => (
    <a data-scroll={String(scroll)} {...props} />
  ),
}))

const categories = [
  { id: 'tea', title: 'Tea Guides', slug: 'tea-guides', count: 3 },
  { id: 'life', title: 'Lifestyle', slug: 'lifestyle', count: 2 },
]

const placeNavigation = (top: number) => {
  const navigation = screen.getByRole('navigation', { name: 'Blog categories' })
  navigation.getBoundingClientRect = () => ({ top }) as DOMRect
  return navigation
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('blog category navigation scroll', () => {
  it('opts out of Next scroll-to-top for every category link', () => {
    render(<BlogCategoryTabs categories={categories} />)
    for (const link of screen.getAllByRole('link')) expect(link.dataset.scroll).toBe('false')
  })

  it('scrolls by the layout shift between the old and new navigation position', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { unmount } = render(<BlogCategoryTabs categories={categories} />)
    placeNavigation(300)
    fireEvent.click(screen.getAllByRole('link', { name: 'Lifestyle' })[0]!)
    unmount()

    // A new route mounts a new navigation lower in the document.
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 575 } as DOMRect)
    render(<BlogCategoryTabs categories={categories} currentCategory="lifestyle" />)
    expect(scrollBy).toHaveBeenCalledExactlyOnceWith({ top: 275, behavior: 'instant' })
    getBoundingClientRect.mockRestore()
  })

  it('ignores modified clicks and the current category', () => {
    const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { unmount } = render(<BlogCategoryTabs categories={categories} currentCategory="tea-guides" />)
    placeNavigation(300)
    fireEvent.click(screen.getAllByRole('link', { name: 'Lifestyle' })[0]!, { metaKey: true })
    fireEvent.click(screen.getAllByRole('link', { name: 'Tea Guides' })[0]!)
    unmount()
    render(<BlogCategoryTabs categories={categories} currentCategory="lifestyle" />)
    expect(scrollBy).not.toHaveBeenCalled()
  })
})
