import { cleanup, render, screen } from '@testing-library/react'
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

afterEach(cleanup)

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

  it('uses the shared desktop grid breakpoints regardless of card count', () => {
    const block: HeaderNavigationBlockData = { cards: [card('one', 'One')], cta: null, heading: null, id: 'one', type: 'cardGroup' }
    const { container } = render(<NavigationBlocks blocks={[block]} />)
    const size = container.querySelector('[data-media]')?.getAttribute('data-size') ?? ''
    expect(size).toContain('(max-width: 1099px) 33vw')
    expect(size.endsWith('25vw')).toBe(true)
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

  it('retains the largest observed desktop category panel height and reports it to the owner', () => {
    const onHeight = vi.fn()
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
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
  })
})

const CategoryTabsForTest = ({ block, onSessionHeightChange }: { block: Extract<HeaderNavigationBlockData, { type: 'categoryTabs' }>; onSessionHeightChange: (height: number) => void }) => <CategoryTabs block={block} onSessionHeightChange={onSessionHeightChange} />
