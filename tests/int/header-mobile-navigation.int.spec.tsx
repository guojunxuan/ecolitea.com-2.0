import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileNav } from '@/Header/Nav/MobileNav'
import { initialNavigationState, navigationReducer } from '@/Header/Nav/navigationState'
import type { HeaderNavigationData } from '@/Header/Nav/types'
import type { LogoImage } from '@/components/Logo/types'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const link = (label: string, href = `/${label.toLowerCase().replaceAll(' ', '-')}`) => ({
  href,
  label,
  newTab: false,
  type: 'custom' as const,
})

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
      link: link('Company'),
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
  it('tracks section identity and preserves session maps when returning to root', () => {
    const open = navigationReducer(initialNavigationState, {
      type: 'openSection',
      sectionId: 'products',
    })
    expect(open.activeSectionId).toBe('products')
    const withScroll = navigationReducer(open, {
      type: 'setSectionScrollTop',
      sectionId: 'products',
      scrollTop: 180,
    })
    const back = navigationReducer(withScroll, {
      type: 'backToRoot',
      sectionId: 'products',
      scrollTop: 180,
    })
    expect(back.activeSectionId).toBeNull()
    expect(back.sectionScrollTop.products).toBe(180)
    expect(navigationReducer(back, { type: 'reset' })).toEqual(initialNavigationState)
  })

  it('allows one compact accordion state per block and ignores no legacy level actions', () => {
    const next = navigationReducer(initialNavigationState, {
      type: 'setSectionAccordion',
      blockId: 'tabs',
      categoryId: 'lighting',
    })
    expect(next.sectionAccordion).toEqual({ tabs: 'lighting' })
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

  it('opens a compact root list and closes direct links', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(screen.getByRole('link', { name: 'Ecolitea' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open Products' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('link', { name: 'Pricing' }))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(openButton)
    expect(dialog).toBeTruthy()
  })

  it('opens a section view, keeps hybrid destination separate, and returns with Back', () => {
    render(<MobileNav {...navigation} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    const companyLink = screen.getByRole('link', { name: 'Company' })
    expect(companyLink.getAttribute('href')).toBe('/company')
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to navigation' }))
    expect(screen.getAllByRole('heading', { name: 'Products' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back to navigation' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to navigation' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Products' }))
  })

  it('uses Escape as section → root → closed and restores focus', () => {
    render(<MobileNav {...navigation} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    fireEvent.click(screen.getByRole('button', { name: 'Open Products' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Open Products' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(openButton)
  })

  it('renders the selected section blocks in compact mode and keeps CTA at root end', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('link', { name: 'Talk to sales' }).getAttribute('href')).toBe(
      '/contact',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open Company' }))
    expect(
      screen
        .getByTestId('mobile-navigation-section')
        .querySelector('[data-navigation-block="richCard"]'),
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Talk to sales' })).toBeNull()
  })

  it('closes on outside pointer, route change, and desktop mode transition', () => {
    const { rerender } = render(<MobileNav {...navigation} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    fireEvent.click(openButton)
    pathname = '/next'
    rerender(<MobileNav {...navigation} />)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    fireEvent.click(openButton)
    act(() => desktopMedia.setMatches(true))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
  })

  it('traps focus within the compact dialog', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    const first = within(dialog).getByRole('link', { name: 'Ecolitea' })
    const last = within(dialog).getByRole('link', { name: 'Talk to sales' })
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('restores the page scroll position when the lock is released', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 })
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(window.scrollTo).toHaveBeenCalledWith(0, 420)
  })
})
