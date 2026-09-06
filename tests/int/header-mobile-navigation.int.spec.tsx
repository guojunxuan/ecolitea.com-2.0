import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileNav } from '@/Header/Nav/MobileNav'
import { initialNavigationState, navigationReducer } from '@/Header/Nav/navigationState'
import type { HeaderNavigationData } from '@/Header/Nav/types'
import type { LogoImage } from '@/components/Logo/types'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/components/RichText', () => ({
  default: () => <p>Featured editorial copy</p>,
}))

const link = (label: string, href = `/${label.toLowerCase().replaceAll(' ', '-')}`) => ({
  href,
  label,
  newTab: false,
  type: 'custom' as const,
})

const dropdown = {
  description: 'Explore the complete platform',
  descriptionLinks: [{ id: 'overview-link', link: link('Platform introduction') }],
  items: [
    {
      id: 'operations',
      type: 'default' as const,
      defaultItem: { description: 'Run daily work', link: link('Operations') },
    },
    {
      id: 'featured',
      type: 'featured' as const,
      featuredItem: {
        tag: 'Featured',
        landingLink: link('View all featured'),
        label: { root: { children: [], type: 'root' } } as never,
        links: [{ id: 'story', link: link('Customer story') }],
      },
    },
    {
      id: 'resources',
      type: 'list' as const,
      listItem: {
        tag: 'Resources',
        landingLink: link('View all resources'),
        links: [{ id: 'guide', link: link('Implementation guide') }],
      },
    },
  ],
}

const navigation: HeaderNavigationData = {
  menuCta: link('Talk to sales', '/contact'),
  navItems: [
    {
      dropdown: null,
      id: 'pricing',
      label: 'Pricing',
      link: link('Pricing'),
      navigationType: 'directLink',
    },
    { dropdown, id: 'platform', label: 'Platform', link: null, navigationType: 'dropdown' },
    {
      dropdown,
      id: 'company',
      label: 'Company',
      link: link('Company'),
      navigationType: 'directLinkAndDropdown',
    },
  ],
}

const logo: LogoImage = {
  alt: 'Ecolitea',
  height: 40,
  src: '/media/ecolitea.svg',
  width: 160,
}

class MediaQueryListMock {
  matches = false
  listeners = new Set<(event: MediaQueryListEvent) => void>()
  media = '(min-width: 73.125rem)'
  addEventListener = (_type: string, listener: (event: MediaQueryListEvent) => void) => {
    this.listeners.add(listener)
  }
  removeEventListener = (_type: string, listener: (event: MediaQueryListEvent) => void) => {
    this.listeners.delete(listener)
  }
  setMatches(matches: boolean) {
    this.matches = matches
    this.listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
  }
}

let desktopMedia: MediaQueryListMock

describe('navigationReducer', () => {
  it('moves through 1 → 2 → 3 → 2 → 1 and clears indexes on reset', () => {
    const level2 = navigationReducer(initialNavigationState, {
      navItemIndex: 1,
      type: 'openDropdown',
    })
    expect(level2).toEqual({ activeItemIndex: null, activeNavItemIndex: 1, level: 2 })

    const level3 = navigationReducer(level2, { itemIndex: 2, type: 'openItem' })
    expect(level3).toEqual({ activeItemIndex: 2, activeNavItemIndex: 1, level: 3 })
    expect(navigationReducer(level3, { type: 'back' })).toEqual(level2)
    expect(navigationReducer(level2, { type: 'back' })).toEqual(initialNavigationState)
    expect(navigationReducer(level3, { type: 'reset' })).toEqual(initialNavigationState)
  })

  it('ignores invalid third-level transitions', () => {
    expect(navigationReducer(initialNavigationState, { itemIndex: 0, type: 'openItem' })).toEqual(
      initialNavigationState,
    )
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
  })

  afterEach(() => {
    cleanup()
    document.body.style.overflow = ''
    vi.unstubAllGlobals()
  })

  it('opens one full-screen three-panel track and closes direct destinations', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)

    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(dialog.getAttribute('data-level')).toBe('1')
    expect(within(dialog).getAllByTestId('mobile-navigation-panel')).toHaveLength(3)
    expect(within(dialog).getByRole('img', { name: 'Ecolitea' })).toBeTruthy()
    expect(document.activeElement).toBe(within(dialog).getByRole('link', { name: 'Pricing' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close navigation' }))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(openButton)
    fireEvent.click(openButton)

    const pricingLink = screen.getByRole('link', { name: 'Pricing' })
    pricingLink.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(pricingLink)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(openButton)
    expect(document.body.style.overflow).toBe('clip')
  })

  it('renders hybrid Overview, default links, and featured/list third levels', () => {
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Company' }))

    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(dialog.getAttribute('data-level')).toBe('2')
    expect(within(dialog).getByRole('heading', { name: 'Company' })).toBeTruthy()
    expect(within(dialog).getByText('Explore the complete platform')).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe(
      '/company',
    )
    const operationsLink = within(dialog).getByRole('link', { name: 'Operations' })
    expect(operationsLink).toBeTruthy()
    expect(operationsLink.parentElement?.textContent).toContain('Run daily work')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Featured' }))
    expect(dialog.getAttribute('data-level')).toBe('3')
    expect(within(dialog).getByRole('heading', { name: 'Featured' })).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'Customer story' })).toBeTruthy()
    const viewAllFeatured = within(dialog).getByRole('link', { name: 'View all featured' })
    const customerStory = within(dialog).getByRole('link', { name: 'Customer story' })
    expect(
      viewAllFeatured.compareDocumentPosition(customerStory) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Company' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Resources' }))
    expect(within(dialog).getByRole('link', { name: 'Implementation guide' })).toBeTruthy()
    expect(within(dialog).getByRole('link', { name: 'View all resources' })).toBeTruthy()
  })

  it('restores focus on Back, Escape, and close', () => {
    render(<MobileNav {...navigation} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Pricing' }))
    const companyButton = screen.getByRole('button', { name: 'Open Company' })
    fireEvent.click(companyButton)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to Navigation' }))
    const featuredButton = screen.getByRole('button', { name: 'Open Featured' })
    fireEvent.click(featuredButton)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back to Company' }))

    fireEvent.click(screen.getByRole('button', { name: 'Back to Company' }))
    expect(document.activeElement).toBe(featuredButton)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Navigation' }))
    expect(document.activeElement).toBe(companyButton)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.activeElement).toBe(openButton)
  })

  it('traps forward and reverse Tab focus inside the open overlay', () => {
    render(<MobileNav {...navigation} logo={logo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    const logoLink = within(dialog).getByRole('link', { name: 'Ecolitea' })
    const cta = within(dialog).getByRole('link', { name: 'Talk to sales' })

    cta.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(logoLink)

    logoLink.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(cta)
  })

  it('keeps body scroll locked until every open navigation instance closes', () => {
    render(
      <>
        <MobileNav {...navigation} />
        <MobileNav {...navigation} />
      </>,
    )
    const openButtons = screen.getAllByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButtons[0])
    fireEvent.click(openButtons[1])
    expect(document.body.style.overflow).toBe('hidden')

    const closeButtons = screen.getAllByRole('button', { name: 'Close navigation' })
    fireEvent.click(closeButtons[0])
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(document.body.style.overflow).toBe('clip')
  })

  it('resets on route changes and desktop transition and restores scroll on unmount', () => {
    const { rerender, unmount } = render(<MobileNav {...navigation} />)
    const openButton = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(openButton)
    fireEvent.click(screen.getByRole('button', { name: 'Open Platform' }))

    pathname = '/next-page'
    rerender(<MobileNav {...navigation} />)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.body.style.overflow).toBe('clip')

    fireEvent.click(openButton)
    act(() => desktopMedia.setMatches(true))
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
    expect(document.body.style.overflow).toBe('clip')

    act(() => desktopMedia.setMatches(false))
    fireEvent.click(openButton)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('clip')
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 73.125rem)')
  })

  it('keeps CTA available in the shared tablet/mobile navigation', () => {
    render(<MobileNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('link', { name: 'Talk to sales' }).getAttribute('href')).toBe(
      '/contact',
    )
  })
})
