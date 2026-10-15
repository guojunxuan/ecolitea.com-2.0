import { cleanup, fireEvent, render, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BlogCategoryTabs } from '@/components/BlogCategoryTabs'

const categories = [
  { id: 'guides', title: 'Tea Guides', slug: 'tea-guides', count: 3 },
  { id: 'news', title: 'News', slug: 'news', count: 2 },
]

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isLink = this.tagName === 'A'
    const isAll = this.textContent === 'All'
    const isNews = this.textContent === 'News'
    return {
      left: isNews ? 300 : isLink && !isAll ? 120 : 20,
      top: 40,
      width: isLink ? (isAll || isNews ? 64 : 140) : 600,
      height: 52,
      bottom: 92,
      right: 620,
      x: 20,
      y: 40,
      toJSON: () => ({}),
    }
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const desktop = (container: HTMLElement) => {
  const row = container.querySelector<HTMLElement>('[data-slot="blog-category-links"]')!
  return {
    row,
    all: within(row).getByRole('link', { name: 'All' }),
    guides: within(row).getByRole('link', { name: 'Tea Guides' }),
    indicator: row.querySelector<HTMLElement>('[data-category-indicator]')!,
  }
}

describe('Blog category text navigation', () => {
  it('defaults to All and hides article counts from link labels', () => {
    const { container } = render(<BlogCategoryTabs categories={categories} />)
    const { all, guides, indicator } = desktop(container)
    expect(all.getAttribute('aria-current')).toBe('page')
    expect(guides.textContent).toBe('Tea Guides')
    expect(indicator.getAttribute('data-visible')).toBe('false')
  })

  it('keeps All selected while a separate hover line moves and hides on leave', () => {
    const { container } = render(<BlogCategoryTabs categories={categories} />)
    const { row, all, guides, indicator } = desktop(container)
    fireEvent.pointerEnter(guides)
    expect(indicator.style.width).toBe('140px')
    expect(indicator.style.transform).toBe('translate(100px, 50px)')
    expect(all.getAttribute('aria-current')).toBe('page')
    expect(guides.getAttribute('aria-current')).toBeNull()
    expect(indicator.getAttribute('data-visible')).toBe('true')
    fireEvent.pointerEnter(within(row).getByRole('link', { name: 'News' }))
    expect(indicator.style.transform).toBe('translate(280px, 50px)')
    expect(indicator.style.width).toBe('64px')
    expect(all.getAttribute('aria-current')).toBe('page')
    fireEvent.pointerLeave(row)
    expect(indicator.getAttribute('data-visible')).toBe('false')
  })

  it('shows the second line for keyboard focus and hides it on blur', () => {
    const { container } = render(<BlogCategoryTabs categories={categories} />)
    const { guides, indicator } = desktop(container)
    fireEvent.focus(guides)
    expect(indicator.style.width).toBe('140px')
    fireEvent.blur(guides)
    expect(indicator.getAttribute('data-visible')).toBe('false')
  })

  it('updates the selected underline when the route category changes', () => {
    const { container, rerender } = render(<BlogCategoryTabs categories={categories} />)
    rerender(<BlogCategoryTabs categories={categories} currentCategory="tea-guides" />)
    const { guides, indicator } = desktop(container)
    expect(guides.getAttribute('aria-current')).toBe('page')
    expect(indicator.getAttribute('data-visible')).toBe('false')
  })

  it('opens a mobile dropdown containing all categories and closes on Escape or outside press', () => {
    const { container } = render(<BlogCategoryTabs categories={categories} />)
    const menu = container.querySelector<HTMLDetailsElement>('[data-slot="blog-mobile-menu"]')!
    const summary = menu.querySelector('summary')!
    expect(summary.textContent).toContain('All')
    expect(menu.open).toBe(false)
    fireEvent.click(summary)
    expect(menu.open).toBe(true)
    expect(within(menu).getByRole('link', { name: 'All' })).toBeTruthy()
    expect(within(menu).getByRole('link', { name: 'Tea Guides' })).toBeTruthy()
    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(menu.open).toBe(false)
    expect(document.activeElement).toBe(summary)
    fireEvent.click(summary)
    fireEvent.pointerDown(document.body)
    expect(menu.open).toBe(false)
  })
})
