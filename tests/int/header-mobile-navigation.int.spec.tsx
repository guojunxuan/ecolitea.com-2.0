import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileNav } from '@/Header/Nav/MobileNav'
import { HeaderNav } from '@/Header/Nav'
import { initialNavigationState, navigationReducer } from '@/Header/Nav/navigationState'
import type { HeaderNavigationData } from '@/Header/Nav/types'
import type { LogoImage } from '@/components/Logo/types'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const link = (
  label: string,
  href = `/${label.toLowerCase().replaceAll(' ', '-')}`,
  newTab = false,
) => ({ href, label, newTab, type: 'custom' as const })

const card = (id: string, title: string) => ({ id, image: null, link: link(title), title })

const navigation: HeaderNavigationData = {
  menuCta: link('Talk to sales', '/contact'),
  navItems: [
    {
      content: null,
      id: 'pricing',
      label: 'Pricing',
      link: link('Pricing'),
      navigationType: 'directLink',
    },
    {
      content: [
        {
          categories: [
            { cards: [card('bulb', 'Bulb')], cta: null, id: 'lighting', label: 'Lighting' },
            {
              cards: [card('panel', 'Control panel')],
              cta: null,
              id: 'controls',
              label: 'Controls',
            },
          ],
          cta: null,
          id: 'product-categories',
          type: 'categoryTabs',
        },
        {
          heading: 'Products',
          id: 'products-links',
          links: [{ id: 'overview', link: link('Overview') }],
          type: 'linkGroup',
        },
      ],
      id: 'products',
      label: 'Products',
      link: null,
      navigationType: 'dropdown',
    },
    {
      content: [
        {
          card: card('story', 'Customer story'),
          description: 'See how customers use our platform',
          id: 'company-story',
          type: 'richCard',
        },
      ],
      id: 'company',
      label: 'Company',
      link: link('Company', '/company', true),
      navigationType: 'directLinkAndDropdown',
    },
  ],
}

const logo: LogoImage = { alt: 'Ecolitea', height: 40, src: '/media/ecolitea.svg', width: 160 }

class MediaQueryListMock {
  matches = false
  listeners = new Set<(event: MediaQueryListEvent) => void>()
  media = '(width > 1170px)'
  addEventListener = (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    this.listeners.add(listener)
  removeEventListener = (_type: string, listener: (event: MediaQueryListEvent) => void) =>
    this.listeners.delete(listener)
  setMatches(matches: boolean) {
    this.matches = matches
    this.listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
  }
}

let desktopMedia: MediaQueryListMock

describe('navigationReducer', () => {
  it('keeps one top-level section open and clears compact Category state when it changes', () => {
    const products = navigationReducer(initialNavigationState, {
      type: 'toggleSection',
      sectionId: 'products',
    })
    const withCategory = navigationReducer(products, {
      type: 'setSectionAccordion',
      blockId: 'product-categories',
      categoryId: 'lighting',
    })
    const company = navigationReducer(withCategory, {
      type: 'toggleSection',
      sectionId: 'company',
    })

    expect(company).toEqual({ activeSectionId: 'company', sectionAccordion: {} })
  })

  it('returns the exact initial state when the active section closes or navigation resets', () => {
    const open = navigationReducer(initialNavigationState, {
      type: 'toggleSection',
      sectionId: 'products',
    })

    expect(navigationReducer(open, { type: 'toggleSection', sectionId: 'products' })).toEqual(
      initialNavigationState,
    )
    expect(navigationReducer(open, { type: 'reset' })).toEqual(initialNavigationState)
    expect(initialNavigationState).toEqual({ activeSectionId: null, sectionAccordion: {} })
  })
})

describe('MobileNav', () => {
  beforeEach(() => {
    pathname = '/'
    document.body.style.overflow = 'clip'
    desktopMedia = new MediaQueryListMock()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => desktopMedia),
    )
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
    vi.unstubAllGlobals()
  })

  it('keeps one mobile root with the toolbar geometry and no drill-down view', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    const menuButton = screen.getByRole('button', { name: 'Open navigation' })

    expect(menuButton.querySelectorAll('span')).toHaveLength(3)
    fireEvent.click(menuButton)

    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(within(dialog).getByRole('button', { name: 'Close navigation' })).toBe(menuButton)
    expect(within(dialog).getByRole('link', { name: 'Ecolitea' })).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Search' })).toBeTruthy()
    expect(dialog.querySelector('[data-mobile-navigation-surface="true"]')).toBeTruthy()
    expect(within(dialog).getByTestId('mobile-navigation-root')).toBeTruthy()
    expect(screen.queryByTestId('mobile-navigation-section')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Back to navigation' })).toBeNull()
  })

  it('allows one top-level expansion and renders the hybrid destination at its bottom', () => {
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

    const products = screen.getByRole('button', { name: 'Open Products' })
    const company = screen.getByRole('button', { name: 'Open Company' })
    expect(products.getAttribute('aria-expanded')).toBe('false')
    expect(company.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(products)
    expect(products.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()

    fireEvent.click(company)
    expect(products.getAttribute('aria-expanded')).toBe('false')
    expect(company.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull()
    const viewAll = screen.getByRole('link', { name: 'View all Company' })
    expect(viewAll.getAttribute('href')).toBe('/company')
    expect(viewAll.getAttribute('target')).toBe('_blank')
    expect(viewAll.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('keeps compact Categories closed, single-open, and resets them across section changes', () => {
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))

    const lighting = screen.getByRole('button', { name: 'Lighting' })
    const controls = screen.getByRole('button', { name: 'Controls' })
    expect(lighting.getAttribute('aria-expanded')).toBe('false')
    expect(controls.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(lighting)
    expect(lighting.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Bulb' })).toBeTruthy()
    fireEvent.click(controls)
    expect(lighting.getAttribute('aria-expanded')).toBe('false')
    expect(controls.getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByRole('link', { name: 'Bulb' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Control panel' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Open Company' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))
    expect(screen.getByRole('button', { name: 'Lighting' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(screen.getByRole('button', { name: 'Controls' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('keeps direct links marked with a fixed arrow and the CTA outside the scrolling root', () => {
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const root = screen.getByTestId('mobile-navigation-root')
    const pricing = screen.getByRole('link', { name: 'Pricing' })
    const cta = screen.getByRole('link', { name: 'Talk to sales' })

    expect(pricing.querySelector('svg')).toBeTruthy()
    expect(root.contains(cta)).toBe(false)
    expect(cta.parentElement?.getAttribute('data-mobile-cta-bar')).toBe('true')
  })

  it('closes, resets accordion and panel scroll, restores focus, and restores body scroll lock', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 })
    render(<MobileNav {...navigation} />)
    const menuButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(menuButton)
    const root = screen.getByTestId('mobile-navigation-root')
    root.scrollTop = 140
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lighting' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(menuButton)
    expect(document.body.style.overflow).toBe('clip')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)

    fireEvent.click(menuButton)
    expect(screen.getByTestId('mobile-navigation-root').scrollTop).toBe(0)
    expect(
      screen.getByRole('button', { name: 'Open Products' }).getAttribute('aria-expanded'),
    ).toBe('false')
    expect(screen.queryByRole('button', { name: 'Lighting' })).toBeNull()
  })

  it('closes directly on Escape and returns focus to the hamburger', () => {
    render(<MobileNav {...navigation} />)
    const menuButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(menuButton)
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(menuButton)
  })

  it('closes on outside pointer, route change, and the strict desktop transition', () => {
    const { rerender } = render(<MobileNav {...navigation} />)
    const menuButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(menuButton)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()

    fireEvent.click(menuButton)
    pathname = '/next'
    rerender(<MobileNav {...navigation} />)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()

    fireEvent.click(menuButton)
    expect(window.matchMedia).toHaveBeenCalledWith('(width > 1170px)')
    act(() => desktopMedia.setMatches(true))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
  })

  it('hands focus to the visible desktop navigation after the strict breakpoint transition', () => {
    const { container } = render(
      <HeaderNav
        {...navigation}
        logo={logo}
        siteName="Ecolitea"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))
    const mobileCategory = screen.getByRole('button', { name: 'Lighting' })
    mobileCategory.focus()

    act(() => desktopMedia.setMatches(true))

    const desktopRoot = container.querySelector<HTMLElement>('[data-desktop-nav-root="true"]')
    const desktopPricing = within(desktopRoot!).getByRole('link', { name: 'Pricing' })
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(desktopPricing)
  })

  it('hands focus from desktop menu content to the visible Compact trigger', () => {
    desktopMedia.setMatches(true)
    const { container } = render(
      <HeaderNav
        {...navigation}
        logo={logo}
        siteName="Ecolitea"
      />,
    )
    const desktopRoot = container.querySelector<HTMLElement>('[data-desktop-nav-root="true"]')
    fireEvent.click(within(desktopRoot!).getByRole('button', { name: 'Products' }))
    const desktopMenuLink = within(desktopRoot!).getByRole('link', { name: 'Overview' })
    desktopMenuLink.focus()
    desktopMedia.matches = false
    desktopMenuLink.blur()

    act(() =>
      desktopMedia.listeners.forEach((listener) =>
        listener({ matches: false } as MediaQueryListEvent),
      ),
    )

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }))
    expect(
      within(desktopRoot!).getByRole('button', { name: 'Products' }).getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('resets an active section removed by live navigation data without closing the menu', () => {
    const { rerender } = render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))

    rerender(
      <MobileNav
        {...navigation}
        navItems={navigation.navItems.filter((item) => item.id !== 'products')}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull()
  })

  it('traps focus and isolates background interaction for the complete mobile dialog', () => {
    render(
      <div>
        <button data-testid="background-action" type="button">
          Background action
        </button>
        <MobileNav {...navigation} logo={logo} />
      </div>,
    )
    const background = screen.getByTestId('background-action')
    const menuButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(menuButton)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    const first = within(dialog).getByRole('button', { name: 'Close navigation' })
    const last = within(dialog).getByRole('link', { name: 'Talk to sales' })

    expect(background.hasAttribute('inert')).toBe(true)
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    background.focus()
    fireEvent.focusIn(background)
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.click(first)
    expect(background.hasAttribute('inert')).toBe(false)
  })

  it('defines accordion, hamburger, divider, fixed CTA, and compact card CSS contracts', () => {
    const navigationCSS = readFileSync(
      resolve(process.cwd(), 'src/Header/Nav/index.module.css'),
      'utf8',
    )
    const blocksCSS = readFileSync(
      resolve(process.cwd(), 'src/Header/Nav/blocks.module.css'),
      'utf8',
    )

    expect(navigationCSS).toContain('grid-template-rows: 0fr')
    expect(navigationCSS).toContain('grid-template-rows: 1fr')
    expect(navigationCSS).toContain('200ms')
    expect(navigationCSS).toContain('transform 300ms')
    expect(navigationCSS).toContain('border-bottom: 1px solid var(--border)')
    expect(navigationCSS).toMatch(/\.mobileMenuCtaBar\s*\{[^}]*position: fixed/s)
    expect(blocksCSS).toMatch(
      /\.navigationBlocksCompact[^}]*\.productCardGrid[^}]*repeat\(2, minmax\(0, 1fr\)\)/s,
    )
    expect(blocksCSS).toMatch(
      /\.navigationBlocksCompact[^}]*\.visualCardGrid:not\(\.visualGridOne\)[^}]*repeat\(2, minmax\(0, 1fr\)\)/s,
    )
    expect(blocksCSS).toMatch(/\.navigationBlocksCompact[^}]*\.linkList a[^}]*min-height: 2\.75rem/s)
    expect(blocksCSS).toMatch(
      /\.navigationBlocksCompact\s*>\s*\*\s*\+\s*\*[^}]*border-top: 1px solid/s,
    )
    expect(blocksCSS).not.toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.categoryChevronOpen\s*\{[^}]*transform: none/,
    )
  })
})
