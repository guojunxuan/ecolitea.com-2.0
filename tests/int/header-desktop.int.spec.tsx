import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

describe('DesktopNav', () => {
  beforeEach(() => {
    pathname = '/'
    ResizeObserverMock.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
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

    fireEvent.click(screen.getByRole('button', { name: 'Company menu' }))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Company menu' })).toBeNull()
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
      const element = this
      const width =
        element.dataset.desktopNavRoot === 'true' ? 650 : element.dataset.measureItem ? 140 : 0
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

  it('keeps every item accessible when ResizeObserver is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render(<DesktopNav menuCta={null} navItems={navigation.navItems} />)
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Platform menu' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Company' })).toBeTruthy()
  })
})
