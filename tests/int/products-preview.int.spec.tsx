import React from 'react'
import Link from 'next/link'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OverflowCarousel } from '@/components/Products/OverflowCarousel'

import { ProductPreviewGrid } from '@/components/Products/ProductPreviewGrid'

let dimensions = { width: 400, total: 1000 }
const resizeCallbacks: (() => void)[] = []
const scrollBy = vi.fn()
const capture = vi.fn()
const release = vi.fn()

function preview(count: number, totalProducts = 5) {
  return (
    <ProductPreviewGrid href="/products/tea" categoryTitle="Tea bags" totalProducts={totalProducts}>
      {Array.from({ length: count }, (_, index) => (
        <a key={index} href={`/products/tea/bag-${index}`} data-product-card>
          <h3>Bag {index}</h3>
        </a>
      ))}
    </ProductPreviewGrid>
  )
}

beforeEach(() => {
  dimensions = { width: 400, total: 1000 }
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => dimensions.width)
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => dimensions.total)
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
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
    'PointerEvent',
    class extends MouseEvent {
      pointerId: number
      pointerType: string
      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options)
        this.pointerId = options.pointerId ?? 1
        this.pointerType = options.pointerType ?? 'mouse'
      }
    },
  )
  HTMLElement.prototype.scrollBy = scrollBy
  HTMLElement.prototype.setPointerCapture = capture
  HTMLElement.prototype.releasePointerCapture = release
  HTMLElement.prototype.hasPointerCapture = () => true
})

afterEach(() => {
  cleanup()
  resizeCallbacks.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  scrollBy.mockReset()
  capture.mockReset()
  release.mockReset()
})

describe('product category previews', () => {
  it('omits an empty preview instead of inventing cards or an entry', () => {
    const { container } = render(preview(0))
    expect(container.childElementCount).toBe(0)
  })

  it.each([1, 2, 3, 4])('keeps %s real product links followed by one category entry', (count) => {
    render(preview(count))
    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(count + 1)
    expect(
      items.slice(0, -1).map((item) => within(item).getByRole('link').getAttribute('href')),
    ).toEqual(Array.from({ length: count }, (_, index) => `/products/tea/bag-${index}`))
    expect(
      within(items.at(-1)!)
        .getByRole('link', { name: 'View More · Tea bags' })
        .getAttribute('href'),
    ).toBe('/products/tea')
    expect(within(items.at(-1)!).queryByRole('heading')).toBeNull()
  })

  it.each([1, 2, 3, 4, 5])('uses category total %s for the responsive more entry', (total) => {
    render(preview(Math.min(total, 4), total))
    const link = screen.queryByRole('link', { name: 'View More · Tea bags' })
    if (total <= 3) expect(link).toBeNull()
    else {
      expect(link).not.toBeNull()
      expect(link?.parentElement?.hasAttribute('data-mobile-only')).toBe(total === 4)
    }
  })

  it('removes arrows and an extra Tab stop when all cards fit', () => {
    dimensions = { width: 1000, total: 1000 }
    render(preview(1))
    const track = screen.getByRole('region', { name: 'Latest Products · Tea bags' })
    expect(track.tabIndex).toBe(-1)
    expect(track.getAttribute('aria-roledescription')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    dimensions.total = 1400
    act(() => resizeCallbacks.forEach((callback) => callback()))
    expect(track.tabIndex).toBe(0)
    expect(track.getAttribute('aria-roledescription')).toBe('carousel')
    expect(screen.getByRole('button', { name: 'Next items' })).toBeTruthy()
  })

  it('handles arrow keys on the track without hijacking keys on links', () => {
    render(preview(4))
    const track = screen.getByRole('region', { name: 'Latest Products · Tea bags' })
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledWith({ left: 320, behavior: 'smooth' })
    fireEvent.keyDown(screen.getByRole('link', { name: 'Bag 0' }), { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenCalledTimes(1)
  })

  it('drags with the mouse and suppresses the resulting click, then permits the next click', () => {
    render(preview(4))
    const track = screen.getByRole('region', { name: 'Latest Products · Tea bags' })
    const link = screen.getByRole('link', { name: 'Bag 0' })
    const onClick = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', onClick)
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 250 })
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 70 })
    expect(track.scrollLeft).toBe(180)
    expect(capture).toHaveBeenCalledWith(1)
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'mouse' })
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.pointerDown(track, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 70 })
    fireEvent.pointerUp(track, { pointerId: 2, pointerType: 'mouse' })
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('leaves touch gestures to native scrolling and clears a cancelled mouse drag', () => {
    render(preview(4))
    const track = screen.getByRole('region', { name: 'Latest Products · Tea bags' })
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'touch', clientX: 250 })
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'touch', clientX: 70 })
    expect(track.scrollLeft).toBe(0)
    expect(capture).not.toHaveBeenCalled()
    fireEvent.pointerDown(track, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 250 })
    fireEvent.pointerMove(track, { pointerId: 2, pointerType: 'mouse', buttons: 1, clientX: 70 })
    fireEvent.pointerCancel(track, { pointerId: 2, pointerType: 'mouse' })
    const onClick = vi.fn((event: Event) => event.preventDefault())
    const link = screen.getByRole('link', { name: 'Bag 0' })
    link.addEventListener('click', onClick)
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledOnce()
    expect(track.hasAttribute('data-dragging')).toBe(false)
  })
})

describe.each(['products', 'categories'] as const)('shared %s carousel gestures', (variant) => {
  it('supports mouse dragging and keyboard navigation without following a dragged link', () => {
    render(
      <OverflowCarousel title="Shared carousel" variant={variant}>
        <Link href="/products/test">Test card</Link>
      </OverflowCarousel>,
    )
    const track = screen.getByRole('region', { name: 'Shared carousel' })
    const link = screen.getByRole('link', { name: 'Test card' })
    const onClick = vi.fn((event: Event) => event.preventDefault())
    link.addEventListener('click', onClick)
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 250 })
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 70 })
    expect(track.scrollLeft).toBe(180)
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: 'mouse' })
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 320, behavior: 'smooth' })
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -320, behavior: 'smooth' })
  })
})
