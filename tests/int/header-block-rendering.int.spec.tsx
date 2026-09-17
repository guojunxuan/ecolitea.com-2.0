import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []
  observed = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this)
  }

  observe = vi.fn((element: Element) => this.observed.add(element))
  disconnect = vi.fn()

  emit() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

beforeEach(() => {
  ResizeObserverMock.instances = []
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Header navigation block rendering', () => {
  it('keeps visual cards icon-free and places the group CTA in the heading row', () => {
    const block: HeaderNavigationBlockData = {
      cards: [card('one', 'First card'), card('two', 'Second card')],
      cta: { href: '/all', label: 'View all', newTab: false, type: 'custom' },
      heading: 'Featured',
      id: 'featured',
      type: 'cardGroup',
    }

    const { container } = render(<NavigationBlocks blocks={[block]} />)

    const cardLinks = screen.getAllByRole('link', { name: /card$/i })
    const blockHeader = container.querySelector('[class*="blockHeader"]') as HTMLElement
    const cta = screen.getByRole('link', { name: 'View all' })
    expect(cardLinks).toHaveLength(2)
    expect(cardLinks[0].querySelector('[data-media="reserved"]')).toBeTruthy()
    expect(cardLinks[0].querySelector('[data-media]')?.getAttribute('data-presentation')).toBe(
      JSON.stringify({ image: { aspectRatio: { width: 16, height: 9 }, fit: 'cover' } }),
    )
    expect(cardLinks[0].textContent).toContain('First card')
    expect(cardLinks.every((link) => link.querySelector('svg') === null)).toBe(true)
    expect(within(blockHeader).getByRole('heading', { name: 'Featured' })).toBeTruthy()
    expect(within(blockHeader).getByRole('link', { name: 'View all' })).toBe(cta)
    expect(cta.className).toContain('blockCTA')
    expect(container.textContent).not.toContain('→')

    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    expect(css).toMatch(/\.visualCardGrid\s*\{[^}]*column-gap:\s*1\.5rem[^}]*row-gap:\s*1rem/s)
    expect(css).toMatch(/\.visualGridMany\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[^{]*\{[^}]*\.visualCardGrid:not\(\.visualGridOne\)[^}]*grid-template-columns:\s*repeat\(2,/s)
    expect(css).toMatch(/\.navigationCardVisual\s*\{[^}]*border-radius:\s*\.5rem/s)
    expect(css).toMatch(/\.navigationCardGradient\s*\{[^}]*inset:\s*65%\s+0\s+0/s)
    expect(css).toMatch(/\.navigationCardVisual[^}]*:global\(img\)[^}]*transition:\s*transform\s+360ms/s)
  })

  it('renders one independent natural-height rich card with contained 16:9 media and clamped text', () => {
    const block: HeaderNavigationBlockData = {
      card: card('rich', 'Rich title'),
      description: 'Helpful description',
      id: 'rich-block',
      type: 'richCard',
    }

    const { container } = render(<NavigationBlocks blocks={[block]} />)

    expect(screen.getByText('Helpful description')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Rich title/ }).className).toContain('navigationCardRich')
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-presentation')).toBe(
      JSON.stringify({ image: { aspectRatio: { width: 16, height: 9 }, fit: 'contain' } }),
    )
    expect(screen.getByRole('link', { name: /Rich title/ }).querySelector('[data-media]')?.getAttribute('data-size')).toContain('100vw')
    expect(container.querySelectorAll('[data-navigation-block="richCard"]')).toHaveLength(1)
    expect(container.querySelector('[data-navigation-block="richCard"]')?.children).toHaveLength(1)
    expect(container.querySelector('svg')).toBeNull()

    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    expect(css).toMatch(/\.richCardGroup\s*\{[^}]*align-self:\s*start/s)
    expect(css).toMatch(/\.navigationCardRich\s+\.navigationCardImage\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/s)
    expect(css).toMatch(/\.navigationCardRich\s+\.navigationCardTitle\s*\{[^}]*-webkit-line-clamp:\s*2/s)
    expect(css).toMatch(/\.navigationCardRich\s+\.navigationCardDescription\s*\{[^}]*-webkit-line-clamp:\s*3/s)
  })

  it('uses an empty header placeholder when a Card Group has a CTA without a heading', () => {
    const block: HeaderNavigationBlockData = {
      cards: [card('one', 'One')],
      cta: { href: '/all', label: 'View all', newTab: false, type: 'custom' },
      heading: null,
      id: 'headingless-cards',
      type: 'cardGroup',
    }

    const { container } = render(<NavigationBlocks blocks={[block]} />)
    const blockHeader = container.querySelector('[class*="blockHeader"]') as HTMLElement
    expect(blockHeader.firstElementChild?.tagName).toBe('SPAN')
    expect(blockHeader.lastElementChild).toBe(screen.getByRole('link', { name: 'View all' }))
  })

  it('keeps Link Group anchors undecorated until underline-only hover', () => {
    const block: HeaderNavigationBlockData = {
      heading: 'Resources',
      id: 'resources',
      links: [{ id: 'guide', link: { href: '/guide', label: 'Guide', newTab: false, type: 'custom' } }],
      type: 'linkGroup',
    }

    const { container } = render(<NavigationBlocks blocks={[block]} />)
    const link = screen.getByRole('link', { name: 'Guide' })
    expect(link.querySelector('svg')).toBeNull()
    expect(link.textContent).toBe('Guide')
    expect(container.textContent).not.toContain('→')

    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    expect(css).toMatch(/\.linkGroup\s+\.blockHeading\s*\{[^}]*font-size:\s*\.75rem[^}]*font-weight:\s*700/s)
    expect(css).toMatch(/\.linkList\s+a\s*\{[^}]*font-size:\s*\.875rem[^}]*font-weight:\s*400[^}]*min-height:\s*2rem/s)
    expect(css).toMatch(/\.linkList\s+a:hover\s*\{[^}]*text-decoration:\s*underline/s)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[^{]*\{[\s\S]*?\.linkList\s+a\s*\{[^}]*min-height:\s*2\.75rem/s)
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

  it('implements vertical roving tabs with keyboard selection and labelled panels', () => {
    const block: HeaderNavigationBlockData = {
      categories: [
        { cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' },
        { cards: [card('two', 'Two')], cta: null, id: 'cat-two', label: 'Category Two' },
        { cards: [card('three', 'Three')], cta: null, id: 'cat-three', label: 'Category Three' },
      ],
      cta: null,
      id: 'categories',
      type: 'categoryTabs',
    }
    render(<NavigationBlocks blocks={[block]} />)
    const tablist = screen.getByRole('tablist', { name: 'Categories' })
    const tabs = screen.getAllByRole('tab')
    expect(tablist.getAttribute('aria-orientation')).toBe('vertical')
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1])
    expect(new Set(tabs.map((tab) => tab.getAttribute('aria-controls'))).size).toBe(3)
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '')
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id)
    }

    tabs[0].focus()
    fireEvent.keyDown(tabs[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1])
    fireEvent.keyDown(tabs[1], { key: 'End' })
    expect(document.activeElement).toBe(tabs[2])
    fireEvent.keyDown(tabs[2], { key: 'Home' })
    expect(document.activeElement).toBe(tabs[0])
    fireEvent.keyDown(tabs[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(tabs[2])
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[2].id)
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

  it('reports a committed maximum height once when the parent updates in response', async () => {
    const onHeight = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: null,
      id: 'reported-height-tabs',
      type: 'categoryTabs',
    }
    const Harness = () => {
      const [, setHeight] = React.useState(0)
      return (
        <CategoryTabs
          block={block}
          onSessionHeightChange={(height) => {
            onHeight(height)
            setHeight(height)
          }}
        />
      )
    }
    const { container } = render(<Harness />)
    const panelStack = container.querySelector('[data-category-panel-stack]') as HTMLElement
    Object.defineProperty(panelStack, 'scrollHeight', { configurable: true, value: 720 })
    Object.defineProperty(panelStack, 'clientHeight', { configurable: true, value: 400 })

    window.dispatchEvent(new Event('resize'))

    await waitFor(() => expect(onHeight).toHaveBeenCalledTimes(1))
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(onHeight).toHaveBeenCalledTimes(1))
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('Cannot update a component')
    consoleError.mockRestore()
  })

  it('reserves the tallest category before switching from a short first category', async () => {
    const block: HeaderNavigationBlockData = {
      categories: [
        { cards: [card('short', 'Short product')], cta: null, id: 'short', label: 'Short category' },
        {
          cards: Array.from({ length: 8 }, (_, index) => card(`tall-${index}`, `Tall product ${index + 1}`)),
          cta: null,
          id: 'tall',
          label: 'Tall category',
        },
      ],
      cta: null,
      id: 'stable-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(
      <>
        <CategoryTabs block={block} />
        <div data-testid="following-block">Following block</div>
      </>,
    )
    const panelStack = container.querySelector('[data-category-panel-stack]') as HTMLElement
    const followingBlock = screen.getByTestId('following-block')
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2)
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    expect(css).toMatch(/\.categoryPanelStack\s*\{[^}]*display:\s*grid/s)
    expect(css).toMatch(/\.categoryPanel\s*\{[^}]*grid-area:\s*1\s*\/\s*1/s)
    expect(css).toMatch(/\.categoryPanelInactive\s*\{[^}]*visibility:\s*hidden/s)
    Object.defineProperty(panelStack, 'scrollHeight', { configurable: true, value: 720 })
    Object.defineProperty(panelStack, 'clientHeight', { configurable: true, value: 720 })

    window.dispatchEvent(new Event('resize'))

    await waitFor(() => expect(panelStack.style.minHeight).toBe('720px'))
    fireEvent.click(screen.getByRole('tab', { name: 'Tall category' }))
    expect(screen.getByRole('link', { name: 'Tall product 8' })).toBeTruthy()
    expect(panelStack.style.minHeight).toBe('720px')
    expect(screen.getByTestId('following-block')).toBe(followingBlock)
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
    const selectorList = screen.getByRole('tablist', { name: 'Categories' })
    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 300 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('true'))

    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: window.innerHeight + 1 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('false'))
  })

  it('uses the Mega Menu scrollport client height and padding for the sticky fit boundary', async () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: null,
      id: 'scrollport-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(
      <div
        data-mega-menu-scroll="true"
        data-testid="mega-menu-scrollport"
        style={{ overflowY: 'auto', paddingBottom: 40, paddingTop: 32 }}
      >
        <CategoryTabs block={block} />
      </div>,
    )
    const scrollport = screen.getByTestId('mega-menu-scrollport')
    const selectorColumn = container.querySelector('[data-category-selector-column]') as HTMLElement
    const selectorList = screen.getByRole('tablist', { name: 'Categories' })
    Object.defineProperty(scrollport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 550 })

    window.dispatchEvent(new Event('resize'))

    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('false'))
    expect(selectorColumn.style.maxHeight).toBe('')

    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 500 })
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('true'))
    expect(selectorColumn.style.maxHeight).toBe('528px')

    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')
    const stickyRule = css.match(/\.categorySelectorColumnSticky\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(stickyRule).not.toContain('70dvh')
  })

  it('ignores product-row grid stretch when the intrinsic category controls fit', async () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: { href: '/all', label: 'View all products', newTab: false, type: 'custom' },
      id: 'intrinsic-tabs',
      type: 'categoryTabs',
    }
    const { container } = render(
      <div
        data-mega-menu-scroll="true"
        data-testid="stretched-menu-scrollport"
        style={{ overflowY: 'auto', paddingBottom: 40, paddingTop: 32 }}
      >
        <CategoryTabs block={block} />
      </div>,
    )
    const scrollport = screen.getByTestId('stretched-menu-scrollport')
    const selectorColumn = container.querySelector('[data-category-selector-column]') as HTMLElement
    const selectorList = screen.getByRole('tablist', { name: 'Categories' })
    const primaryCTA = screen.getByRole('link', { name: 'View all products' })
    Object.defineProperty(scrollport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(selectorColumn, 'scrollHeight', { configurable: true, value: 900 })
    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 400 })
    Object.defineProperty(primaryCTA, 'scrollHeight', { configurable: true, value: 80 })

    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(selectorColumn.getAttribute('data-sticky')).toBe('true')
      expect(selectorColumn.style.maxHeight).toBe('528px')
    })
  })

  it('remeasures sticky fit when intrinsic controls resize and disconnects observers', async () => {
    const block: HeaderNavigationBlockData = {
      categories: [{ cards: [card('one', 'One')], cta: null, id: 'cat-one', label: 'Category One' }],
      cta: { href: '/all', label: 'View all products', newTab: false, type: 'custom' },
      id: 'observed-tabs',
      type: 'categoryTabs',
    }
    const { container, unmount } = render(
      <div data-mega-menu-scroll="true" data-testid="observed-scrollport">
        <CategoryTabs block={block} />
      </div>,
    )
    const scrollport = screen.getByTestId('observed-scrollport')
    const selectorColumn = container.querySelector('[data-category-selector-column]') as HTMLElement
    const selectorList = screen.getByRole('tablist', { name: 'Categories' })
    const primaryCTA = screen.getByRole('link', { name: 'View all products' })
    Object.defineProperty(scrollport, 'clientHeight', { configurable: true, value: 600 })
    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 400 })
    Object.defineProperty(primaryCTA, 'scrollHeight', { configurable: true, value: 80 })
    const observer = ResizeObserverMock.instances.find((instance) => instance.observed.has(scrollport))

    expect(observer?.observed.has(selectorList)).toBe(true)
    expect(observer?.observed.has(primaryCTA)).toBe(true)
    observer?.emit()
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('true'))

    Object.defineProperty(selectorList, 'scrollHeight', { configurable: true, value: 560 })
    observer?.emit()
    await waitFor(() => expect(selectorColumn.getAttribute('data-sticky')).toBe('false'))

    unmount()
    expect(observer?.disconnect).toHaveBeenCalledOnce()
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
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.categoryTab[^}]*transition:\s*none/s)
  })

  it('omits descriptions and icons from product cards', () => {
    const { container } = render(
      <NavigationCard card={card('product', 'Product')} description="Product description" variant="product" />,
    )
    expect(screen.queryByText('Product description')).toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('uses the standard four-column desktop contract for exactly three visual cards', () => {
    const block: HeaderNavigationBlockData = {
      cards: [card('one', 'One'), card('two', 'Two'), card('three', 'Three')],
      cta: null,
      heading: null,
      id: 'three-cards',
      type: 'cardGroup',
    }
    const { container } = render(<NavigationBlocks blocks={[block]} />)
    const grid = container.querySelector('[data-card-count="3"] > div') as HTMLElement
    const sizes = [...grid.querySelectorAll('[data-media]')].map((node) => node.getAttribute('data-size'))
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'), 'utf8')

    expect(grid.className).toContain('visualGridMany')
    expect(grid.className).not.toContain('visualGridThree')
    expect(sizes.every((size) => size?.endsWith('25vw'))).toBe(true)
    expect(css).toMatch(/\.visualGridMany\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s)
    expect(css).not.toMatch(/\.visualGridThree\s*\{/)
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)[^{]*\{[^}]*\.visualCardGrid:not\(\.visualGridOne\)[^}]*grid-template-columns:\s*repeat\(2,/s)
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
    expect(container.querySelector('[data-card-count="3"] > div')?.className).toContain('visualGridMany')
    const sizes = [...container.querySelectorAll('[data-navigation-block="cardGroup"] [data-media]')].map((node) => node.getAttribute('data-size'))
    expect(sizes[0]).toContain('50vw')
    expect(sizes[1]).toContain('25vw')
    expect(sizes.at(-1)).toContain('25vw')
  })
})

const CategoryTabsForTest = ({ block, onSessionHeightChange }: { block: Extract<HeaderNavigationBlockData, { type: 'categoryTabs' }>; onSessionHeightChange: (height: number) => void }) => <CategoryTabs block={block} onSessionHeightChange={onSessionHeightChange} />
