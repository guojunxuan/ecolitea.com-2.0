import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderNavigationBlockData } from '@/Header/Nav/types'

vi.mock('@/components/Media', () => ({
  Media: ({ resource, presentation, size }: { resource: unknown; presentation?: unknown; size?: string }) => (
    <div data-media={resource ? 'loaded' : 'reserved'} data-presentation={JSON.stringify(presentation)} data-size={size} />
  ),
}))

import { NavigationBlocks } from '@/Header/Nav/NavigationBlocks'
import { CategoryTabs } from '@/Header/Nav/CategoryTabs'
import { NavigationCard } from '@/Header/Nav/NavigationCard'

const card = (id: string, title: string) => ({
  id,
  image: null,
  link: { href: `/products/${id}`, label: title, newTab: false, type: 'custom' as const },
  title,
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Header navigation block rendering', () => {
  it('keeps each visual card as one anchor with reserved media and puts CTA outside cards', () => {
    const block: HeaderNavigationBlockData = {
      cards: [card('one', 'First card'), card('two', 'Second card')],
      cta: { href: '/all', label: 'View all', newTab: false, type: 'custom' },
      heading: 'Featured',
      id: 'featured',
      type: 'cardGroup',
    }

    render(<NavigationBlocks blocks={[block]} />)

    const cardLinks = screen.getAllByRole('link', { name: /card$/i })
    expect(cardLinks).toHaveLength(2)
    expect(cardLinks[0].querySelector('[data-media="reserved"]')).toBeTruthy()
    expect(cardLinks[0].textContent).toContain('First card')
    expect(screen.getByRole('link', { name: 'View all' }).closest('a')).not.toBe(cardLinks[0])
  })

  it('renders rich card descriptions only when nonblank and uses contained 4:3 media', () => {
    const block: HeaderNavigationBlockData = {
      card: card('rich', 'Rich title'),
      description: 'Helpful description',
      id: 'rich-block',
      type: 'richCard',
    }

    render(<NavigationBlocks blocks={[block]} />)

    expect(screen.getByText('Helpful description')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ }).className).toContain('navigationCardRich')
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-presentation')).toBe(
      JSON.stringify({ image: { aspectRatio: { width: 4, height: 3 }, fit: 'contain' } }),
    )
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-size')).toContain('100vw')
  })

  it('uses composition tracks based on block density without reordering blocks', () => {
    const blocks: HeaderNavigationBlockData[] = [
      { cards: [card('one', 'One'), card('two', 'Two')], cta: null, heading: null, id: 'cards', type: 'cardGroup' },
      { heading: null, id: 'links', links: [{ id: 'link', link: { href: '/link', label: 'Link', newTab: false, type: 'custom' } }], type: 'linkGroup' },
      { card: card('rich', 'Rich'), description: null, id: 'rich', type: 'richCard' },
    ]
    const { container } = render(<NavigationBlocks blocks={blocks} />)
    expect(container.querySelector('[data-block-layout="cardGroup-two"]')).toBeTruthy()
    expect(container.querySelector('[data-block-layout="linkGroup-one"]')).toBeTruthy()
    expect(container.querySelector('[data-block-layout="richCard-two"]')).toBeTruthy()
    expect([...container.querySelectorAll('[data-navigation-block]')].map((node) => node.getAttribute('data-navigation-block'))).toEqual(['cardGroup', 'linkGroup', 'richCard'])
  })

  it('makes Category Tabs a full-row block and keeps compact visual cards sized to their columns', () => {
    const blocks: HeaderNavigationBlockData[] = [
      { categories: [{ cards: [card('one', 'One'), card('two', 'Two')], cta: null, id: 'cat', label: 'Cat' }], cta: null, id: 'tabs', type: 'categoryTabs' },
      { cards: [card('visual', 'Visual')], cta: null, heading: null, id: 'visual', type: 'cardGroup' },
    ]
    const { container } = render(<NavigationBlocks blocks={blocks} mode="compact" />)
    expect(container.querySelector('[data-navigation-block="categoryTabs"]')?.className).toContain('categoryBlock')
    expect(container.querySelector('[data-navigation-block="cardGroup"] [data-media]')?.getAttribute('data-size')?.startsWith('(max-width: 360px) 100vw')).toBe(true)
  })

  it('matches visual-card sizes to compact breakpoints and wider card-count layouts', () => {
    const oneCard: HeaderNavigationBlockData = { cards: [card('one', 'One')], cta: null, heading: null, id: 'one', type: 'cardGroup' }
    const manyCards: HeaderNavigationBlockData = { cards: [card('one', 'One'), card('two', 'Two'), card('three', 'Three')], cta: null, heading: null, id: 'many', type: 'cardGroup' }
    const { container, rerender } = render(<NavigationBlocks blocks={[oneCard]} mode="compact" />)
    expect(container.querySelector('[data-media]')?.getAttribute('data-size')?.startsWith('(max-width: 360px) 100vw')).toBe(true)
    rerender(<NavigationBlocks blocks={[manyCards]} mode="compact" />)
    expect(container.querySelector('[data-media]')?.getAttribute('data-size')).toContain('(max-width: 767px) 50vw')
  })

  it('sizes a single visual card for its half-width desktop group', () => {
    const block: HeaderNavigationBlockData = { cards: [card('one', 'One')], cta: null, heading: null, id: 'one', type: 'cardGroup' }
    const { container } = render(<NavigationBlocks blocks={[block]} />)
    const size = container.querySelector('[data-media]')?.getAttribute('data-size') ?? ''
    expect(size).toContain('(max-width: 1170px) 100vw')
    expect(size.endsWith('50vw')).toBe(true)
  })

  it('sizes product cards to three columns at 768–1099px and rich cards to a full compact row', () => {
    const productSize = (() => {
      const { container, unmount } = render(<NavigationCard card={card('product', 'Product')} variant="product" />)
      const value = container.querySelector('[data-media]')?.getAttribute('data-size') ?? ''
      unmount()
      return value
    })()
    const richSize = (() => {
      const { container } = render(<NavigationCard card={card('rich', 'Rich')} variant="rich" />)
      return container.querySelector('[data-media]')?.getAttribute('data-size') ?? ''
    })()
    expect(productSize.startsWith('(max-width: 360px) 100vw')).toBe(true)
    expect(productSize).toContain('(max-width: 1099px) 33vw')
    expect(productSize.endsWith('25vw')).toBe(true)
    expect(richSize).toContain('(max-width: 1170px) 100vw')
  })

  it('exposes accessible desktop category controls with stable panel relationships', () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: null,
      id: 'categories',
      type: 'categoryTabs',
    }
    render(<NavigationBlocks blocks={[block]} />)
    const tab = screen.getByRole('tab', { name: 'Category One' })
    expect(tab.getAttribute('aria-controls')).toBe('categories-panel')
    expect(tab.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('categories-panel')).toBeTruthy()
    expect([...screen.getAllByRole('tab')].every((control) => document.getElementById(control.getAttribute('aria-controls') ?? '') !== null)).toBe(true)
  })

  it('keeps category CTAs with their owners without rendering arrow glyphs', () => {
    const block: HeaderNavigationBlockData = {
      categories: [
        {
          cards: [card('one', 'One')],
          cta: { href: '/category', label: 'View category', newTab: false, type: 'custom' },
          id: 'cat-one',
          label: 'Category One',
        },
      ],
      cta: { href: '/all', label: 'View all products', newTab: false, type: 'custom' },
      id: 'cta-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(<CategoryTabs block={block} />)
    const selectorColumn = container.querySelector('[data-category-selector-column]') as HTMLElement
    const productHeader = container.querySelector('[data-category-product-header]') as HTMLElement

    expect(within(selectorColumn).getByRole('link', { name: 'View all products' })).toBeTruthy()
    expect(within(productHeader).getByRole('link', { name: 'View category' })).toBeTruthy()
    expect(container.textContent).not.toContain('→')
  })

  it('uses 100ms category hover intent while clicks switch immediately and pending timers are replaced', () => {
    vi.useFakeTimers()
    const onActiveCategoryChange = vi.fn()
    const block: HeaderNavigationBlockData = {
      categories: [
        { cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' },
        { cards: [card('two', 'Two')], cta: null, id: 'cat-two', label: 'Category Two' },
        { cards: [card('three', 'Three')], cta: null, id: 'cat-three', label: 'Category Three' },
      ],
      cta: null,
      id: 'intent-tabs',
      type: 'categoryTabs',
    }
    const { unmount } = render(<CategoryTabs block={block} onActiveCategoryChange={onActiveCategoryChange} />)

    const categoryTwo = screen.getByRole('tab', { name: 'Category Two' })
    fireEvent.pointerEnter(categoryTwo)
    act(() => vi.advanceTimersByTime(99))
    expect(screen.queryByRole('link', { name: 'Two' })).toBeNull()
    fireEvent.pointerLeave(categoryTwo)
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('link', { name: 'One' })).toBeTruthy()

    fireEvent.pointerEnter(categoryTwo)
    fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Category Three' }))
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByRole('link', { name: 'Three' })).toBeTruthy()

    fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Category Two' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Category One' }))
    expect(screen.getByRole('link', { name: 'One' })).toBeTruthy()
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByRole('link', { name: 'One' })).toBeTruthy()
    expect(onActiveCategoryChange).toHaveBeenCalledTimes(2)
    fireEvent.pointerEnter(screen.getByRole('tab', { name: 'Category Two' }))
    unmount()
    act(() => vi.runOnlyPendingTimers())
    expect(onActiveCategoryChange).toHaveBeenCalledTimes(2)
  })

  it('retains the largest observed desktop category panel height without applying a cap', async () => {
    const onHeight = vi.fn()
    const block: HeaderNavigationBlockData = {
      categories: [
        { cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' },
        { cards: [card('two', 'Two')], cta: null, id: 'cat-two', label: 'Category Two' },
      ],
      cta: null,
      id: 'height-tabs',
      type: 'categoryTabs',
    }
    render(<CategoryTabsForTest block={block} onSessionHeightChange={onHeight} />)
    const panel = document.getElementById('height-tabs-panel') as HTMLElement
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 720 })
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 400 })
    window.dispatchEvent(new Event('resize'))
    expect(onHeight.mock.calls.length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(panel.style.minHeight).toBe('720px')
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Category Two' }))
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 320 })
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 320 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(panel.style.minHeight).toBe('720px'))
    expect(panel.style.maxHeight).toBe('')
    expect(onHeight).toHaveBeenCalledWith(720)
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    const categoryPanelRule = css.match(/\.categoryPanel\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(categoryPanelRule).not.toMatch(/overflow-y\s*:/)
    expect(categoryPanelRule).not.toMatch(/max-height\s*:/)
  })

  it('uses a local sticky category column only when its contents fit the visible height', async () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: null,
      id: 'sticky-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(<CategoryTabs block={block} />)
    const selectorColumn = container.querySelector('[data-category-selector-column]') as HTMLElement
    Object.defineProperty(selectorColumn, 'scrollHeight', { configurable: true, value: 300 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('true'))

    Object.defineProperty(selectorColumn, 'scrollHeight', { configurable: true, value: window.innerHeight + 1 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('false'))
  })

  it('renders eight product cards as a stable four-by-two grid with the product-card contract', () => {
    const block: HeaderNavigationBlockData = {
      categories: [
        {
          cards: Array.from({ length: 8 }, (_, index) => card(`product-${index}`, `Product ${index + 1}`)),
          cta: null,
          id: 'eight-products',
          label: 'Eight products',
        },
      ],
      cta: null,
      id: 'grid-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(<CategoryTabs block={block} />)
    const grid = container.querySelector('[data-product-card-grid]') as HTMLElement
    expect(grid.children).toHaveLength(8)
    expect([...grid.children].every((node) => node.className.includes('navigationCardProduct'))).toBe(true)
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    expect(css).toMatch(/\.productCardGrid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s)
    expect(css).toMatch(/\.navigationCardProduct\s*\{[^}]*background:/s)
    expect(css).toMatch(/\.navigationCardProduct[^}]*:global\(img\)[^}]*max-(?:height|width):\s*82%/s)
    expect(css).toMatch(/\.navigationCardProduct:hover[^}]*:global\(img\)[^}]*scale\(1\.035\)/s)
  })

  it('omits descriptions and icons from product cards', () => {
    const { container } = render(
      <NavigationCard card={card('product', 'Product')} description="Product description" variant="product" />,
    )
    expect(screen.queryByText('Product description')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('uses card-count grids without reserving empty four-column tracks in half-width groups', () => {
    const blocks: HeaderNavigationBlockData[] = [
      { cards: [card('one', 'One')], cta: null, heading: null, id: 'one', type: 'cardGroup' },
      { cards: [card('two-a', 'Two A'), card('two-b', 'Two B')], cta: null, heading: null, id: 'two', type: 'cardGroup' },
      { cards: [card('three-a', 'Three A'), card('three-b', 'Three B'), card('three-c', 'Three C')], cta: null, heading: null, id: 'three', type: 'cardGroup' },
    ]
    const { container } = render(<NavigationBlocks blocks={blocks} />)
    expect(container.querySelector('[data-card-count="1"] > div')?.className).toContain('visualGridOne')
    expect(container.querySelector('[data-card-count="2"] > div')?.className).toContain('visualGridTwo')
    expect(container.querySelector('[data-card-count="3"] > div')?.className).toContain('visualGridThree')
    const sizes = [...container.querySelectorAll('[data-navigation-block="cardGroup"] [data-media]')].map((node) => node.getAttribute('data-size'))
    expect(sizes[0]).toContain('50vw')
    expect(sizes[1]).toContain('25vw')
    expect(sizes.at(-1)).toContain('33vw')
  })
})

const CategoryTabsForTest = ({ block, onSessionHeightChange }: { block: Extract<HeaderNavigationBlockData, { type: 'categoryTabs' }>; onSessionHeightChange: (height: number) => void }) => <CategoryTabs block={block} onSessionHeightChange={onSessionHeightChange} />
