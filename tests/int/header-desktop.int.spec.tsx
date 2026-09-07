import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopNav } from '@/Header/Nav/DesktopNav'
import type { HeaderNavigationData, HeaderNavigationItem } from '@/Header/Nav/types'

let pathname = '/'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

vi.mock('@/components/RichText', () => ({
  default: ({ enableGutter }: { enableGutter?: boolean }) => (
    <p data-enable-gutter={String(enableGutter)}>Featured editorial copy</p>
  ),
}))

const link = (label: string, href = `/${label.toLowerCase().replaceAll(' ', '-')}`) => ({
  href,
  label,
  newTab: false,
  type: 'custom' as const,
})

const dropdown = {
  description: 'Explore the complete platform',
  descriptionLinks: [{ id: 'overview', link: link('Platform overview') }],
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
        links: [{ id: 'case-study', link: link('Customer story') }],
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

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverMock.instances.push(this)
  }
  disconnect = vi.fn()
  observe = vi.fn()
  unobserve = vi.fn()
  emit() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

class MediaQueryListMock {
  matches = true
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

describe('DesktopNav', () => {
  beforeEach(() => {
    pathname = '/'
    desktopMedia = new MediaQueryListMock()
    ResizeObserverMock.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => desktopMedia),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('uses destination links and named disclosure controls with one open menu', () => {
    render(<DesktopNav {...navigation} />)

    expect(screen.getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe('/pricing')
    expect(
      screen.getByRole('button', { name: 'Platform menu' }).getAttribute('aria-expanded'),
    ).toBe('false')
    expect(screen.getByRole('link', { name: 'Company' }).getAttribute('href')).toBe('/company')
    expect(screen.getByRole('button', { name: 'Company menu' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Search' }).getAttribute('href')).toBe('/search')
    expect(screen.getByRole('link', { name: 'Talk to sales' }).getAttribute('href')).toBe(
      '/contact',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Platform menu' }))
    const platformMenu = screen.getByRole('region', { name: 'Platform menu' })
    expect(within(platformMenu).getByText('Explore the complete platform')).toBeTruthy()
    expect(within(platformMenu).getByRole('link', { name: 'Platform overview' })).toBeTruthy()
    expect(within(platformMenu).getByRole('link', { name: 'Operations' })).toBeTruthy()
    expect(
      within(platformMenu).getByText('Featured editorial copy').getAttribute('data-enable-gutter'),
    ).toBe('false')
    expect(within(platformMenu).getByRole('link', { name: 'Customer story' })).toBeTruthy()
    expect(within(platformMenu).getByRole('link', { name: 'Implementation guide' })).toBeTruthy()

    const companyButton = screen.getByRole('button', { name: 'Company menu' })
    fireEvent.click(companyButton)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Company menu' })).toBeNull()
    expect(document.activeElement).toBe(companyButton)
  })

  it('closes on an outside pointer and route change', () => {
    const { rerender } = render(<DesktopNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Platform menu' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Platform menu' }))
    pathname = '/another-page'
    rerender(<DesktopNav {...navigation} />)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('closes only when focus leaves the complete Header interaction boundary', () => {
    render(
      <header>
        <button type="button">Brand</button>
        <DesktopNav {...navigation} />
      </header>,
    )

    const platformButton = screen.getByRole('button', { name: 'Platform menu' })
    fireEvent.click(platformButton)
    fireEvent.focusOut(platformButton, {
      relatedTarget: screen.getByRole('link', { name: 'Platform overview' }),
    })
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

    fireEvent.focusOut(screen.getByRole('link', { name: 'Platform overview' }), {
      relatedTarget: screen.getByRole('button', { name: 'Brand' }),
    })
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

    const outside = document.createElement('button')
    document.body.append(outside)
    fireEvent.focusOut(screen.getByRole('button', { name: 'Brand' }), { relatedTarget: outside })
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    outside.remove()
  })

  it('moves measured trailing items into More exactly once', () => {
    const longItems: HeaderNavigationItem[] = Array.from({ length: 8 }, (_, index) => ({
      dropdown: null,
      id: `item-${index}`,
      label: `Long navigation item ${index + 1}`,
      link: link(`Long navigation item ${index + 1}`),
      navigationType: 'directLink',
    }))

    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width =
        this.dataset.desktopNavRoot === 'true' ? 650 : this.dataset.measureItem ? 140 : 0
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })

    render(<DesktopNav menuCta={null} navItems={longItems} />)
    ResizeObserverMock.instances[0]?.emit()

    fireEvent.click(screen.getByRole('button', { name: 'More menu' }))
    const moreMenu = screen.getByRole('region', { name: 'More menu' })
    const visibleLabels = longItems.flatMap((item) =>
      screen.getAllByRole('link', { name: item.label }),
    )
    expect(visibleLabels).toHaveLength(8)
    expect(within(moreMenu).getAllByRole('link')).toHaveLength(5)

    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('measures complete dropdown and hybrid controls after reserving CTA actions', () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.dataset.desktopNavRoot
        ? 540
        : this.dataset.measureItem
          ? this.textContent === 'Pricing'
            ? 100
            : this.textContent === 'Platform'
              ? 120
              : 150
          : this.dataset.measureMore
            ? 80
            : this.querySelector('a[aria-label="Search"]')
              ? 110
              : 0
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })

    render(<DesktopNav {...navigation} />)
    ResizeObserverMock.instances[0]?.emit()

    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Platform menu' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Company' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More menu' }))
    expect(
      within(screen.getByRole('region', { name: 'More menu' })).getByRole('link', {
        name: 'Company',
      }),
    ).toBeTruthy()

    HTMLElement.prototype.getBoundingClientRect = originalRect
  })

  it('closes at the tablet breakpoint and does not reopen on desktop', () => {
    render(<DesktopNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Platform menu' }))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

    act(() => desktopMedia.setMatches(false))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    act(() => desktopMedia.setMatches(true))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('keeps an overflow disclosure mounted and restores focus while closing layers', () => {
    const items: HeaderNavigationItem[] = [
      navigation.navItems[0]!,
      ...Array.from({ length: 4 }, (_, index) => ({
        ...navigation.navItems[1]!,
        id: `dropdown-${index}`,
        label: `Dropdown ${index + 1}`,
      })),
    ]
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.dataset.desktopNavRoot ? 360 : this.dataset.measureItem ? 140 : 80
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })
    render(<DesktopNav menuCta={null} navItems={items} />)

    const moreButton = screen.getByRole('button', { name: 'More menu' })
    fireEvent.click(moreButton)
    const overflowTrigger = within(screen.getByRole('region', { name: 'More menu' })).getByRole(
      'button',
      { name: 'Dropdown 1 menu' },
    )
    fireEvent.click(overflowTrigger)
    expect(overflowTrigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: 'Dropdown 1 menu' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Dropdown 1 menu' })).toBeNull()
    expect(screen.getByRole('region', { name: 'More menu' })).toBeTruthy()
    expect(document.activeElement).toBe(overflowTrigger)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'More menu' })).toBeNull()
    expect(document.activeElement).toBe(moreButton)

    fireEvent.click(moreButton)
    const outside = document.createElement('button')
    document.body.append(outside)
    fireEvent.focusOut(moreButton, { relatedTarget: outside })
    expect(screen.queryByRole('region', { name: 'More menu' })).toBeNull()
    outside.remove()
  })

  it('safely closes and re-owns focus when ResizeObserver repartitions open menus', () => {
    let rootWidth = 1000
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = this.dataset.desktopNavRoot ? rootWidth : this.dataset.measureItem ? 120 : 80
      return {
        bottom: 0,
        height: 0,
        left: 0,
        right: width,
        top: 0,
        width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }
    })
    render(<DesktopNav {...navigation} />)

    fireEvent.click(screen.getByRole('button', { name: 'Platform menu' }))
    rootWidth = 380
    act(() => ResizeObserverMock.instances[0]?.emit())
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    const moreButton = screen.getByRole('button', { name: 'More menu' })
    expect(document.activeElement).toBe(moreButton)
    expect(moreButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(moreButton)
    const overflowTrigger = within(screen.getByRole('region', { name: 'More menu' })).getByRole(
      'button',
      { name: 'Platform menu' },
    )
    fireEvent.click(overflowTrigger)
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

    rootWidth = 1000
    act(() => ResizeObserverMock.instances[0]?.emit())
    expect(screen.queryByRole('region', { name: 'More menu' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    const visiblePlatformTrigger = screen.getByRole('button', { name: 'Platform menu' })
    expect(visiblePlatformTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(visiblePlatformTrigger)
  })

  it('keeps every item accessible when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render(<DesktopNav menuCta={null} navItems={navigation.navItems} />)
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Platform menu' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Company' })).toBeTruthy()
  })
})
