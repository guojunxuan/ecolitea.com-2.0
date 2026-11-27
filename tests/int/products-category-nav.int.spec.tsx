import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { AnchorNav } from '@/components/Products/AnchorNav'

const readStyle = window.getComputedStyle.bind(window)
const intersections: {
  callback: IntersectionObserverCallback
  targets: Element[]
  options?: IntersectionObserverInit
}[] = []
let carouselBottom = 500
let headerHeight = 60
const items = [{ id: 'tea', label: 'Tea bags' }]

beforeEach(() => {
  carouselBottom = 500
  headerHeight = 60
  vi.useFakeTimers()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = readStyle(element)
    return new Proxy(style, {
      get(target, name) {
        if (element.tagName === 'NAV' && name === 'top') return `${headerHeight}px`
        if (element.tagName === 'NAV' && name === 'height') return '56px'
        const value = Reflect.get(target, name)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.id === 'category-carousel'
      ? new DOMRect(0, carouselBottom - 200, 400, 200)
      : new DOMRect(0, 500, 400, 300)
  })
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = []
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersections.push({ callback, options, targets: this.targets })
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
})

afterEach(() => {
  cleanup()
  intersections.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const renderCategoryNav = () =>
  render(
    <>
      <section id="category-carousel">Category cards</section>
      <AnchorNav variant="category" items={items} revealAfter="category-carousel" />
      <section id="tea">Tea products</section>
    </>,
  )

const notifyCarousel = (intersecting: boolean, bottom: number) => {
  const observer = intersections.find(({ targets }) => targets[0]?.id === 'category-carousel')!
  expect(observer).toBeTruthy()
  act(() =>
    observer.callback(
      [
        {
          isIntersecting: intersecting,
          boundingClientRect: new DOMRect(0, bottom - 200, 400, 200),
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    ),
  )
}

it('hides category navigation and its focus targets until the carousel passes the header', () => {
  const { container } = renderCategoryNav()
  const navigation = container.querySelector('nav')!
  expect(screen.queryByRole('navigation', { name: 'Product categories' })).toBeNull()
  expect(navigation.hasAttribute('inert')).toBe(true)
  notifyCarousel(false, 900)
  expect(screen.queryByRole('link', { name: 'Tea bags' })).toBeNull()
  notifyCarousel(true, 160)
  expect(navigation.hasAttribute('inert')).toBe(true)
  notifyCarousel(false, 59)
  expect(screen.getByRole('navigation', { name: 'Product categories' })).toBe(navigation)
  expect(screen.getByRole('link', { name: 'Tea bags' }).getAttribute('href')).toBe('#tea')
  expect(navigation.hasAttribute('inert')).toBe(false)
  notifyCarousel(true, 180)
  expect(navigation.hasAttribute('inert')).toBe(true)
  expect(screen.queryByRole('navigation', { name: 'Product categories' })).toBeNull()
})

it('reveals navigation when the page initially loads below the carousel', () => {
  carouselBottom = -20
  renderCategoryNav()
  expect(screen.getByRole('navigation', { name: 'Product categories' })).toBeTruthy()
})

it('recalculates the boundary when the resolved header height changes', () => {
  carouselBottom = 68
  renderCategoryNav()
  expect(screen.queryByRole('link', { name: 'Tea bags' })).toBeNull()
  headerHeight = 72
  fireEvent.resize(window)
  expect(screen.getByRole('link', { name: 'Tea bags' })).toBeTruthy()
  expect(intersections.at(-1)?.options?.rootMargin).toBe('-72px 0px 0px 0px')
})

it('keeps navigation available when no carousel boundary exists', () => {
  const { rerender } = render(<AnchorNav variant="category" items={items} />)
  expect(screen.getByRole('link', { name: 'Tea bags' })).toBeTruthy()
  rerender(<AnchorNav variant="category" items={items} revealAfter="missing-carousel" />)
  expect(screen.getByRole('link', { name: 'Tea bags' })).toBeTruthy()
})

it('updates the reveal boundary on scroll without IntersectionObserver support', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  renderCategoryNav()
  expect(screen.queryByRole('link', { name: 'Tea bags' })).toBeNull()
  carouselBottom = 59
  act(() => {
    fireEvent.scroll(window)
    vi.advanceTimersByTime(16)
  })
  expect(screen.getByRole('link', { name: 'Tea bags' })).toBeTruthy()
  carouselBottom = 300
  act(() => {
    fireEvent.scroll(window)
    vi.advanceTimersByTime(16)
  })
  expect(screen.queryByRole('link', { name: 'Tea bags' })).toBeNull()
})
