import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { AnchorNav } from '@/components/Products/AnchorNav'

const readStyle = window.getComputedStyle.bind(window)
const scrollIntoView = vi.fn()
const scrollBy = vi.fn()
const observers: {
  callback: IntersectionObserverCallback
  targets: Element[]
  options?: IntersectionObserverInit
}[] = []
let overviewBottom = 700

beforeEach(() => {
  vi.useFakeTimers()
  overviewBottom = 700
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = readStyle(element)
    return new Proxy(style, {
      get(target, name) {
        if (element.tagName === 'NAV' && name === 'top') return '60px'
        if (element.tagName === 'NAV' && name === 'height') return '56px'
        const value = Reflect.get(target, name)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.id === 'overview') return new DOMRect(0, overviewBottom - 500, 400, 500)
    if (this.tagName === 'A') return new DOMRect(380, 0, 100, 56)
    return new DOMRect(0, 300, 400, 56)
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = []
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, targets: this.targets, options })
      }
      observe(target: Element) {
        this.targets.push(target)
      }
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600)
  HTMLElement.prototype.scrollIntoView = scrollIntoView
  HTMLElement.prototype.scrollBy = scrollBy
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  observers.length = 0
  scrollIntoView.mockReset()
  scrollBy.mockReset()
  window.history.replaceState(null, '', '/')
})

const setup = (variant: 'detail' | 'category' = 'detail') =>
  render(
    <>
      <header id="overview">Overview content</header>
      <AnchorNav
        variant={variant}
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'story', label: 'Product story' },
        ]}
      />
      <section id="story" style={{ scrollMarginTop: '12px' }}>
        Story content
      </section>
    </>,
  )

it('uses the visible Header and navigation heights for the first detail section without a fixed override', () => {
  setup()
  const nav = screen.getByRole('navigation', { name: 'Product sections' })
  expect(nav.hasAttribute('data-stuck')).toBe(false)
  fireEvent.click(screen.getByRole('link', { name: 'Product story' }))
  overviewBottom = 60
  act(() => {
    fireEvent.scroll(window)
    vi.advanceTimersByTime(16)
  })
  expect(nav.getAttribute('data-stuck')).toBe('true')
  expect(nav.hasAttribute('data-overview-pin')).toBe(false)
  expect(nav.hasAttribute('data-detached')).toBe(false)
  expect(document.getElementById('story')!.style.scrollMarginTop).toBe('116px')
  expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' })
  expect(window.location.hash).toBe('#story')
})

it.each([700, 40])(
  'returns Overview to natural flow when its previous bottom is %spx',
  (bottom) => {
    overviewBottom = bottom
    setup()
    fireEvent.click(screen.getByRole('link', { name: 'Overview' }))
    expect(screen.getByRole('navigation').hasAttribute('data-stuck')).toBe(false)
    expect(screen.getByRole('navigation').hasAttribute('data-overview-pin')).toBe(false)
    expect(screen.getByRole('navigation').hasAttribute('data-detached')).toBe(false)
    expect(document.getElementById('overview')!.style.scrollMarginTop).toBe('116px')
  },
)

it('clears natural sticky state when scrolling back to Overview and sticks again on the next descent', () => {
  overviewBottom = 40
  setup()
  expect(screen.getByRole('navigation').getAttribute('data-stuck')).toBe('true')
  overviewBottom = 700
  act(() => {
    fireEvent.scroll(window)
    vi.advanceTimersByTime(16)
  })
  expect(screen.getByRole('navigation').hasAttribute('data-stuck')).toBe(false)
  overviewBottom = 40
  act(() => {
    fireEvent.scroll(window)
    vi.advanceTimersByTime(16)
  })
  expect(screen.getByRole('navigation').getAttribute('data-stuck')).toBe('true')
})

it('naturally pins at the visible Header edge', () => {
  setup()
  const boundary = observers.find(
    (observer) => observer.targets.length === 1 && observer.targets[0].id === 'overview',
  )!
  overviewBottom = 70
  act(() =>
    boundary.callback(
      [
        {
          isIntersecting: false,
          boundingClientRect: new DOMRect(0, -430, 400, 500),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  )
  expect(screen.getByRole('navigation').hasAttribute('data-stuck')).toBe(false)
  overviewBottom = 40
  act(() =>
    boundary.callback(
      [
        {
          isIntersecting: false,
          boundingClientRect: new DOMRect(0, -460, 400, 500),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  )
  expect(screen.getByRole('navigation').getAttribute('data-stuck')).toBe('true')
})

it('reveals the active overflow link horizontally without scrolling ancestor containers', () => {
  setup()
  expect(scrollBy).toHaveBeenCalledWith({ left: 80, behavior: 'smooth' })
  expect(scrollIntoView).not.toHaveBeenCalled()
})

it('reveals the current item again when resizing changes the available width', () => {
  setup()
  scrollBy.mockClear()
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.id === 'overview') return new DOMRect(0, overviewBottom - 500, 400, 500)
    if (this.tagName === 'A') return new DOMRect(450, 0, 100, 56)
    return new DOMRect(0, 300, 400, 56)
  })
  fireEvent.resize(window)
  expect(scrollBy).toHaveBeenCalledWith({ left: 150, behavior: 'smooth' })
})

it('lets manual overflow scrolling reveal other links without snapping back to the current link', () => {
  setup()
  const track = screen.getByRole('link', { name: 'Overview' }).parentElement!
  scrollBy.mockClear()
  track.scrollLeft = 200
  fireEvent.scroll(track)
  expect(scrollBy).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe(
    'location',
  )
})

it('preserves the category offset contract and restores authored margins on unmount', () => {
  const { unmount } = setup('category')
  const story = document.getElementById('story')!
  expect(story.style.scrollMarginTop).toBe(
    'calc(var(--header-height) + var(--website-anchor-nav-height) + var(--website-space-4))',
  )
  unmount()
  expect(story.style.scrollMarginTop).toBe('12px')
})
