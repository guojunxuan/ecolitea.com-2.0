import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import Link from 'next/link'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnchorNav } from '@/components/Products/AnchorNav'
import { CategoryBand } from '@/components/Products/CategoryBand'
import { CategoryCard } from '@/components/Products/CategoryCard'
import { OverflowCarousel } from '@/components/Products/OverflowCarousel'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductMoreCard } from '@/components/Products/ProductMoreCard'
import { SegmentIndicator } from '@/components/Products/SegmentIndicator'
import type { Media } from '@/payload-types'
import type {
  ProductCard as ProductCardModel,
  ProductCategoryModel,
} from '@/utilities/products/models'

vi.mock('@/components/Media', () => ({
  Media: ({ resource }: { resource: Media }) => <span data-testid="media">{resource.alt}</span>,
}))

const actualComputedStyle = window.getComputedStyle.bind(window)

const media = { id: 'image', alt: 'Paper tea bag', url: '/tea.jpg' } as Media
const product: ProductCardModel = {
  id: 'tea',
  title: 'Paper tea bag',
  slug: 'paper',
  categorySlug: 'bags',
  summary: 'Plant fibre filter.',
  cover: media,
}
const category: ProductCategoryModel = {
  id: 'bags',
  title: 'Tea bags',
  slug: 'bags',
  description: 'Filters for loose leaf tea.',
  image: media,
  meta: { image: null },
}
const resizeCallbacks: (() => void)[] = []
const intersections: {
  callback: IntersectionObserverCallback
  targets: Element[]
  options?: IntersectionObserverInit
}[] = []
const scrollBy = vi.fn()
const scrollIntoView = vi.fn()
let dimensions = { width: 400, total: 1000 }

beforeEach(() => {
  dimensions = { width: 400, total: 1000 }
  const computedStyle = actualComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = computedStyle(element)
    return new Proxy(style, {
      get(target, name) {
        if (element.tagName === 'NAV' && name === 'top') return '60px'
        if (element.tagName === 'NAV' && name === 'height') return '56px'
        const value = Reflect.get(target, name)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 400, 300),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      targets: Element[] = []
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        intersections.push({ callback, targets: this.targets, options })
      }
      observe(target: Element) {
        this.targets.push(target)
      }
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => dimensions.width)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => dimensions.total)
  HTMLElement.prototype.scrollBy = scrollBy
  HTMLElement.prototype.scrollIntoView = scrollIntoView
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
})

afterEach(() => {
  cleanup()
  resizeCallbacks.length = 0
  intersections.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  scrollBy.mockReset()
  scrollIntoView.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('shared product presentation', () => {
  it('makes the product a single link with H3 and a safe missing-cover placeholder', () => {
    const { rerender } = render(<ProductCard product={product} />)
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/bags/paper')
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(product.title)
    expect(screen.getByText(product.summary!)).toBeTruthy()
    expect(screen.getByTestId('media')).toBeTruthy()
    rerender(<ProductCard product={{ ...product, cover: null }} />)
    expect(screen.queryByTestId('media')).toBeNull()
    expect(screen.getByRole('link').textContent).toContain(product.title)
  })

  it('limits more-card covers to three and exposes the remaining and total counts', () => {
    render(
      <ProductMoreCard
        href="/products/bags"
        remaining={7}
        productCount={12}
        categoryTitle="Tea bags"
        covers={[media, media, media, media]}
      />,
    )
    expect(screen.getAllByTestId('media')).toHaveLength(3)
    expect(screen.getByText('+7')).toBeTruthy()
    expect(screen.getByText('View all 12')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/bags')
  })

  it('links a category and renders its band at the requested heading level without an empty action row', () => {
    render(
      <>
        <CategoryCard category={category} />
        <CategoryBand
          category={category}
          headingLevel="h1"
          breadcrumb={<nav aria-label="Breadcrumb">Products / Tea bags</nav>}
          actions={null}
        />
      </>,
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/products/bags')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tea bags')
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy()
    expect(document.querySelector('[data-product-band-actions]')).toBeNull()
  })

  it('preserves the banner media focal point for CSS cropping', () => {
    const { container } = render(
      <CategoryBand
        category={{ ...category, image: { ...media, focalX: 25, focalY: 70 } }}
        headingLevel="h2"
        actions={null}
      />,
    )
    expect(
      container
        .querySelector<HTMLElement>('[data-website-theme="inverse"]')
        ?.style.getPropertyValue('--product-image-position'),
    ).toBe('25% 70%')
  })

  it('renders optional block headings and a purely presentational active segment', () => {
    const { container } = render(
      <>
        <ProductBlockHeader eyebrow="Materials" title="Made for tea" />
        <SegmentIndicator count={3} active={1} />
      </>,
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Made for tea')
    expect(container.querySelectorAll('[data-active]')).toHaveLength(1)
    expect(container.querySelector('[data-active]')?.getAttribute('data-active')).toBe('true')
  })
})

describe('overflow carousel', () => {
  it('hides unavailable arrows at each edge and when all content fits', () => {
    render(
      <OverflowCarousel title="Explore ranges">
        <Link href="/one">One</Link>
        <Link href="/two">Two</Link>
      </OverflowCarousel>,
    )
    const track = screen.getByRole('region', { name: 'Explore ranges' })
    expect(screen.queryByRole('button', { name: 'Previous items' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Next items' })).toBeTruthy()
    Object.defineProperty(track, 'scrollLeft', { configurable: true, value: 600 })
    fireEvent.scroll(track)
    expect(screen.getByRole('button', { name: 'Previous items' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next items' })).toBeNull()
    dimensions.total = 400
    act(() => resizeCallbacks.forEach((callback) => callback()))
    expect(screen.queryByRole('button', { name: 'Previous items' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next items' })).toBeNull()
  })

  it('scrolls 80 percent with the keyboard and honors reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    render(
      <OverflowCarousel title="Related">
        <Link href="/one">One</Link>
      </OverflowCarousel>,
    )
    const track = screen.getByRole('region', { name: 'Related' })
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 320, behavior: 'auto' })
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -320, behavior: 'auto' })
    scrollBy.mockClear()
    fireEvent.keyDown(screen.getByRole('link', { name: 'One' }), { key: 'ArrowRight' })
    expect(scrollBy).not.toHaveBeenCalled()
  })
})

describe('anchor navigation', () => {
  const items = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details' },
  ]

  it('shows the detail action only after overview has left above the header', () => {
    render(
      <>
        <section id="overview">Overview content</section>
        <section id="details">Detail content</section>
        <AnchorNav
          items={items}
          variant="detail"
          action={{ type: 'custom', url: '/contact', label: 'Get a Quote' }}
        />
      </>,
    )
    expect(screen.queryByRole('link', { name: 'Get a Quote' })).toBeNull()
    const observer = intersections.find(
      ({ targets }) => targets.length === 1 && targets[0].id === 'overview',
    )!
    expect(observer).toBeTruthy()
    act(() =>
      observer.callback(
        [
          {
            target: document.getElementById('overview')!,
            isIntersecting: false,
            boundingClientRect: new DOMRect(0, -301, 400, 300),
            intersectionRatio: 0,
            intersectionRect: new DOMRect(),
            rootBounds: null,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(screen.getByRole('link', { name: 'Get a Quote' }).getAttribute('href')).toBe('/contact')
    act(() =>
      observer.callback(
        [
          {
            target: document.getElementById('overview')!,
            isIntersecting: true,
            boundingClientRect: new DOMRect(0, 0, 400, 300),
            intersectionRatio: 1,
            intersectionRect: new DOMRect(0, 0, 400, 300),
            rootBounds: null,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(screen.queryByRole('link', { name: 'Get a Quote' })).toBeNull()
  })

  it('keeps a below-fold overview from triggering the detail action or scrolling the page on mount', () => {
    render(
      <>
        <section id="overview">Overview content</section>
        <AnchorNav
          items={items}
          variant="detail"
          action={{ type: 'custom', url: '/contact', label: 'Get a Quote' }}
        />
      </>,
    )
    const observer = intersections.find(
      ({ targets }) => targets.length === 1 && targets[0].id === 'overview',
    )!
    act(() =>
      observer.callback(
        [
          {
            target: document.getElementById('overview')!,
            isIntersecting: false,
            boundingClientRect: new DOMRect(0, 900, 400, 300),
            intersectionRatio: 0,
            intersectionRect: new DOMRect(),
            rootBounds: null,
            time: 0,
          },
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(screen.queryByRole('link', { name: 'Get a Quote' })).toBeNull()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('updates the current section from scrollspy without changing the URL', () => {
    render(
      <>
        <section id="overview">Overview content</section>
        <section id="details">Details content</section>
        <AnchorNav items={items} variant="category" />
      </>,
    )
    const observer = intersections.find(({ targets }) => targets.length === 2)!
    act(() => observer.callback([], {} as IntersectionObserver))
    expect(screen.getByRole('link', { name: 'Details' }).getAttribute('aria-current')).toBe(
      'location',
    )
    expect(window.location.hash).toBe('')
  })

  it('scrolls overflow links by 60 percent and updates the current anchor and URL', () => {
    render(
      <>
        <section id="overview">Overview content</section>
        <section id="details">Detail content</section>
        <AnchorNav items={items} variant="category" />
      </>,
    )
    expect(screen.queryByRole('button', { name: 'Previous sections' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next sections' }))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' })
    fireEvent.click(screen.getByRole('link', { name: 'Details' }))
    expect(window.location.hash).toBe('#details')
    expect(screen.getByRole('link', { name: 'Details' }).getAttribute('aria-current')).toBe(
      'location',
    )
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    dimensions.total = 400
    act(() => resizeCallbacks.forEach((callback) => callback()))
    expect(screen.queryByRole('button', { name: 'Next sections' })).toBeNull()
  })
})

it('updates scrollspy when a section top crosses the activation line without another IO transition', async () => {
  let detailTop = 200
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.id === 'overview'
      ? new DOMRect(0, -900, 400, 800)
      : this.id === 'details'
        ? new DOMRect(0, detailTop, 400, 1000)
        : new DOMRect(0, 0, 400, 300)
  })
  render(
    <>
      <section id="overview">Overview</section>
      <section id="details">Details</section>
      <AnchorNav
        variant="detail"
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'details', label: 'Details' },
        ]}
      />
    </>,
  )
  const observer = intersections.find((item) => item.targets.length === 2)!
  act(() => observer.callback([], {} as IntersectionObserver))
  expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe(
    'location',
  )
  detailTop = 70
  await act(async () => {
    fireEvent.scroll(window)
    await new Promise((resolve) => setTimeout(resolve, 30))
  })
  expect(screen.getByRole('link', { name: 'Details' }).getAttribute('aria-current')).toBe(
    'location',
  )
})

it('uses resolved navigation top and height pixels for observer margins instead of parsing header custom-property units', () => {
  const readStyle = actualComputedStyle
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const style = readStyle(element)
    return new Proxy(style, {
      get(target, name) {
        if (element.tagName === 'NAV' && name === 'top') return '112.75px'
        if (element.tagName === 'NAV' && name === 'height') return '64.5px'
        if (element === document.documentElement && name === 'getPropertyValue')
          return (key: string) =>
            key === '--header-height' ? 'calc(1rem + 10vh)' : style.getPropertyValue(key)
        const value = Reflect.get(target, name)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  })
  render(
    <>
      <section id="overview">Overview</section>
      <section id="details">Details</section>
      <AnchorNav
        variant="detail"
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'details', label: 'Details' },
        ]}
      />
    </>,
  )
  expect(intersections.find((item) => item.targets.length === 2)?.options?.rootMargin).toBe(
    '-177.25px 0px -55% 0px',
  )
  expect(intersections.find((item) => item.targets.length === 1)?.options?.rootMargin).toBe(
    '-112.75px 0px 0px 0px',
  )
})
