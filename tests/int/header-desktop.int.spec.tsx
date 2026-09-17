import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopNav } from '@/Header/Nav/DesktopNav'
import type { HeaderNavigationData, HeaderNavigationItem } from '@/Header/Nav/types'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const link = (label: string, href = `/${label.toLowerCase().replaceAll(' ', '-')}`) => ({
  href,
  label,
  newTab: false,
  type: 'custom' as const,
})
const panel = (id: string, label: string) => ({
  id,
  type: 'linkGroup' as const,
  heading: label,
  links: [{ id: `${id}-link`, link: link(`${label} overview`) }],
})
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
      content: [panel('platform-panel', 'Platform')],
      id: 'platform',
      label: 'Platform',
      link: null,
      navigationType: 'dropdown',
    },
    {
      content: [panel('company-panel', 'Company')],
      id: 'company',
      label: 'Company',
      link: link('Company'),
      navigationType: 'directLinkAndDropdown',
    },
  ],
}

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []
  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this)
  }
  observe = vi.fn()
  disconnect = vi.fn()
  emit() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

describe('DesktopNav', () => {
  beforeEach(() => {
    pathname = '/'
    ResizeObserverMock.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(width > 1170px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('keeps all primary entries in source order with one text control per item', () => {
    render(<DesktopNav {...navigation} />)
    expect(
      within(screen.getByRole('navigation', { name: 'Primary' }))
        .getAllByRole('link')
        .map((node) => node.textContent),
    ).toEqual(['Pricing', 'Company'])
    expect(screen.getByRole('button', { name: 'Platform' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
    expect(screen.getByRole('link', { name: 'Company' }).getAttribute('href')).toBe('/company')
    expect(screen.queryByLabelText('Company menu')).toBeNull()
    expect(screen.queryByTestId('desktop-navigation-chevron')).toBeNull()
    expect(screen.queryByRole('button', { name: /More menu/i })).toBeNull()
  })

  it('uses the exact greater-than-1170px Desktop boundary in JS and CSS', () => {
    render(<DesktopNav {...navigation} />)
    expect(window.matchMedia).toHaveBeenCalledWith('(width > 1170px)')
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/index.module.css'), 'utf8')
    expect(css).toContain('@media (width > 1170px)')
    expect(css).not.toContain('73.1875rem')
  })

  it('uses 100ms first-open intent and switches immediately once a menu is open', () => {
    vi.useFakeTimers()
    render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform' })
    fireEvent.pointerEnter(platform)
    act(() => vi.advanceTimersByTime(99))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Company' }))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
    vi.useRealTimers()
  })

  it('keeps one shell mounted for the 180ms close phase and reports logical close immediately', () => {
    vi.useFakeTimers()
    try {
      const onOpenChange = vi.fn()
      const { container } = render(<DesktopNav {...navigation} onOpenChange={onOpenChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      const shell = container.querySelector('[data-mega-menu-shell="true"]') as HTMLElement
      expect(shell.getAttribute('data-phase')).toBe('open')

      fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }))
      expect(onOpenChange).toHaveBeenLastCalledWith(false)
      expect(container.querySelector('[data-mega-menu-shell="true"]')).toBe(shell)
      expect(shell.getAttribute('data-phase')).toBe('closing')
      act(() => vi.advanceTimersByTime(179))
      expect(container.querySelector('[data-mega-menu-shell="true"]')).toBe(shell)
      act(() => vi.advanceTimersByTime(1))
      expect(container.querySelector('[data-mega-menu-shell="true"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('switches menu content for 160ms without replacing the shell or overlay', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<DesktopNav {...navigation} />)
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      const shell = container.querySelector('[data-mega-menu-shell="true"]') as HTMLElement
      const overlay = container.querySelector('[data-navigation-overlay="true"]') as HTMLElement

      fireEvent.pointerEnter(screen.getByRole('link', { name: 'Company' }))
      expect(container.querySelector('[data-mega-menu-shell="true"]')).toBe(shell)
      expect(container.querySelector('[data-navigation-overlay="true"]')).toBe(overlay)
      expect(shell.getAttribute('data-content-phase')).toBe('switching')
      expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
      act(() => vi.advanceTimersByTime(159))
      expect(shell.getAttribute('data-content-phase')).toBe('switching')
      act(() => vi.advanceTimersByTime(1))
      expect(shell.getAttribute('data-content-phase')).toBe('visible')
    } finally {
      vi.useRealTimers()
    }
  })

  it('click toggles a pure dropdown while a hybrid click remains navigation', () => {
    render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform' })
    fireEvent.click(platform)
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    fireEvent.click(platform)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()

    expect(screen.getByRole('link', { name: 'Company' }).getAttribute('href')).toBe('/company')
  })

  it('keeps the panel open while moving from a trigger into the panel', () => {
    render(
      <header>
        <DesktopNav {...navigation} />
      </header>,
    )
    const platform = screen.getByRole('button', { name: 'Platform' })
    fireEvent.click(platform)
    const panelRegion = screen.getByRole('region', { name: 'Platform menu' })
    fireEvent.pointerLeave(platform, { relatedTarget: panelRegion })
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
  })

  it('treats the overlay as outside the combined hover region', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<DesktopNav {...navigation} />)
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      const root = container.querySelector('[data-desktop-nav-root="true"]') as HTMLElement
      const overlay = container.querySelector('[data-navigation-overlay="true"]') as HTMLElement

      fireEvent.pointerLeave(root, { relatedTarget: overlay })
      fireEvent.pointerEnter(overlay)
      act(() => vi.advanceTimersByTime(199))
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
      expect(container.querySelector('[data-mega-menu-shell="true"]')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the menu open while pointer or focus remains in the combined region', () => {
    vi.useFakeTimers()
    const { container } = render(<DesktopNav {...navigation} />)
    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    const root = container.querySelector('[data-desktop-nav-root="true"]') as HTMLElement
    const panelRegion = screen.getByRole('region', { name: 'Platform menu' })

    fireEvent.pointerLeave(root, { relatedTarget: panelRegion })
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    fireEvent.pointerLeave(panelRegion, { relatedTarget: document.body })
    panelRegion.querySelector<HTMLElement>('a')?.focus()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    document.body.tabIndex = -1
    document.body.focus()
    fireEvent.pointerLeave(panelRegion, { relatedTarget: document.body })
    act(() => vi.advanceTimersByTime(199))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    vi.useRealTimers()
  })

  it('cancels a pending first-open when the pointer moves to a direct link', () => {
    vi.useFakeTimers()
    try {
      render(<DesktopNav {...navigation} />)
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'Platform' }))
      act(() => vi.advanceTimersByTime(50))
      fireEvent.pointerEnter(screen.getByRole('link', { name: 'Pricing' }))
      act(() => vi.advanceTimersByTime(100))
      expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a direct-link close delay when the pointer enters the panel', () => {
    vi.useFakeTimers()
    try {
      render(<DesktopNav {...navigation} />)
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      fireEvent.pointerEnter(screen.getByRole('link', { name: 'Pricing' }))
      fireEvent.pointerEnter(screen.getByRole('region', { name: 'Platform menu' }))
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('restarts the close delay when focus leaves after an earlier pointer leave was protected', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(<DesktopNav {...navigation} />)
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      const root = container.querySelector('[data-desktop-nav-root="true"]') as HTMLElement
      const panelLink = screen.getByRole('link', { name: 'Platform overview' })
      panelLink.focus()

      fireEvent.pointerLeave(root, { relatedTarget: document.body })
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()

      document.body.tabIndex = -1
      fireEvent.blur(panelLink, { relatedTarget: document.body })
      document.body.focus()
      act(() => vi.advanceTimersByTime(199))
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes on Escape, outside activation, and route changes', () => {
    const { rerender } = render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform' })
    fireEvent.click(platform)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    fireEvent.click(platform)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    fireEvent.click(platform)
    pathname = '/new-route'
    rerender(<DesktopNav {...navigation} />)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('opens a hybrid with ArrowDown and restores focus to its link on Escape', () => {
    render(<DesktopNav {...navigation} />)
    const company = screen.getByRole('link', { name: 'Company' })
    company.focus()
    fireEvent.keyDown(company, { key: 'ArrowDown' })
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Company menu' })).toBeNull()
    expect(document.activeElement).toBe(company)
  })

  it('supports the normalized navigation item contract without legacy dropdown fields', () => {
    const item: HeaderNavigationItem = navigation.navItems[1]!
    expect('dropdown' in item).toBe(false)
    if (item.content) expect(item.content[0]?.type).toBe('linkGroup')
  })

  it('does not activate a trigger under a stationary pointer after scrolling', async () => {
    render(<DesktopNav {...navigation} />)
    const strip = screen.getByRole('navigation', { name: 'Primary' })
    Object.defineProperties(strip, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 700 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    })
    strip.scrollTo = vi.fn()
    act(() => ResizeObserverMock.instances.forEach((observer) => observer.emit()))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Scroll navigation right' })).toBeTruthy(),
    )
    const platform = screen.getByRole('button', { name: 'Platform' })
    const company = screen.getByRole('link', { name: 'Company' })
    fireEvent.click(platform)
    fireEvent.click(screen.getByRole('button', { name: 'Scroll navigation left' }))
    fireEvent.pointerEnter(company)
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    fireEvent.pointerMove(company)
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
  })

  it('opens a hybrid with ArrowDown after overflow scrolling suppresses hover', async () => {
    render(<DesktopNav {...navigation} />)
    const strip = screen.getByRole('navigation', { name: 'Primary' })
    Object.defineProperties(strip, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 700 },
      scrollLeft: { configurable: true, value: 120, writable: true },
    })
    fireEvent.scroll(strip)
    fireEvent.keyDown(screen.getByRole('link', { name: 'Company' }), { key: 'ArrowDown' })
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
  })

  it('does not close an active panel when scrolling moves a direct link under a stationary pointer', () => {
    vi.useFakeTimers()
    try {
      render(<DesktopNav {...navigation} />)
      const strip = screen.getByRole('navigation', { name: 'Primary' })
      Object.defineProperties(strip, {
        clientWidth: { configurable: true, value: 300 },
        scrollWidth: { configurable: true, value: 700 },
        scrollLeft: { configurable: true, value: 0, writable: true },
      })
      act(() => ResizeObserverMock.instances.forEach((observer) => observer.emit()))
      expect(screen.getByRole('button', { name: 'Scroll navigation right' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
      const pricing = screen.getByRole('link', { name: 'Pricing' }).closest('[data-nav-item-id]')!
      fireEvent.scroll(strip)
      fireEvent.pointerEnter(pricing)
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
      fireEvent.pointerMove(pricing)
      act(() => vi.advanceTimersByTime(199))
      expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('scrolls a focused primary item into view and clears a removed active owner', () => {
    const { container, rerender } = render(<DesktopNav {...navigation} />)
    const companyRoot = container.querySelector('[data-nav-item-id="company"]') as HTMLElement
    companyRoot.scrollIntoView = vi.fn()
    fireEvent.focus(screen.getByRole('link', { name: 'Company' }))
    expect(companyRoot.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ inline: 'nearest' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    rerender(<DesktopNav menuCta={navigation.menuCta} navItems={[navigation.navItems[0]!]} />)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('shows boundary-preserving controls only when the primary strip overflows', async () => {
    const { container } = render(<DesktopNav {...navigation} />)
    const frame = container.querySelector('[data-navigation-frame="true"]') as HTMLElement
    const strip = screen.getByRole('navigation', { name: 'Primary' })
    Object.defineProperties(strip, {
      clientWidth: {
        configurable: true,
        get: () => (frame.getAttribute('data-overflow') === 'true' ? 236 : 300),
      },
      scrollWidth: { configurable: true, value: 700 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    })
    strip.scrollTo = vi.fn()
    act(() => ResizeObserverMock.instances.forEach((observer) => observer.emit()))
    await waitFor(() => expect(Math.abs(strip.scrollLeft + strip.clientWidth - strip.scrollWidth)).toBeLessThanOrEqual(1))
    expect(strip.scrollLeft).toBe(464)
    expect(frame.getAttribute('data-overflow')).toBe('true')
    expect(frame.getAttribute('data-at-start')).toBe('false')
    expect(frame.getAttribute('data-at-end')).toBe('true')
    expect(
      (screen.getByRole('button', { name: 'Scroll navigation right' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Scroll navigation left' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Scroll navigation left' }))
    expect(strip.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: expect.any(Number) }),
    )
    strip.scrollLeft = 200
    act(() => fireEvent.scroll(strip))
    expect(frame.getAttribute('data-at-start')).toBe('false')
    expect(frame.getAttribute('data-at-end')).toBe('false')
  })

  it('moves one shared indicator across pointer, focus, and strip scrolling', () => {
    const { container } = render(<DesktopNav {...navigation} />)
    const frame = container.querySelector('[data-navigation-frame="true"]') as HTMLElement
    const viewport = container.querySelector('[data-navigation-viewport="true"]') as HTMLElement
    const pricingRoot = container.querySelector('[data-nav-item-id="pricing"]') as HTMLElement
    const companyRoot = container.querySelector('[data-nav-item-id="company"]') as HTMLElement
    const strip = screen.getByRole('navigation', { name: 'Primary' })
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 100 } as DOMRect)
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ left: 132 } as DOMRect)
    vi.spyOn(pricingRoot, 'getBoundingClientRect').mockReturnValue({ left: 152, width: 50 } as DOMRect)
    vi.spyOn(companyRoot, 'getBoundingClientRect').mockReturnValue({ left: 252, width: 80 } as DOMRect)

    fireEvent.pointerEnter(pricingRoot)
    const indicator = container.querySelector('[data-navigation-indicator="true"]') as HTMLElement
    expect(indicator.style.transform).toBe('translateX(20px)')
    expect(indicator.style.width).toBe('50px')
    fireEvent.focus(screen.getByRole('link', { name: 'Company' }))
    expect(indicator.style.transform).toBe('translateX(120px)')
    expect(indicator.style.width).toBe('80px')

    vi.spyOn(companyRoot, 'getBoundingClientRect').mockReturnValue({ left: 222, width: 80 } as DOMRect)
    fireEvent.scroll(strip)
    expect(indicator.style.transform).toBe('translateX(90px)')
    expect(indicator.style.width).toBe('80px')
  })

  it('renders one overlay and one scrolling region, and overlay activation closes it', () => {
    const { container } = render(<DesktopNav {...navigation} />)
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Platform' }))

    const overlay = screen.getByRole('button', { name: 'Close navigation menu' })
    expect(overlay.getAttribute('tabindex')).toBe('-1')
    expect(container.querySelectorAll('[data-mega-menu-scroll="true"]')).toHaveLength(1)
    fireEvent.scroll(window)
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    fireEvent.click(overlay)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('defines the approved glass, overlay, single-scroll, and reduced-motion CSS', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Nav/index.module.css'), 'utf8')
    expect(css).toContain('rgb(255 255 255 / 82%)')
    expect(css).toContain('blur(28px) saturate(120%)')
    expect(css).toContain('rgb(0 0 0 / 7%)')
    expect(css).toContain('max-height: min(70dvh, 42rem)')
    expect(css).toContain('overscroll-behavior-y: auto')
    expect(css).toContain('180ms')
    expect(css).toContain('height 220ms')
    expect(css).toContain('opacity 160ms')
    expect(css).toContain('translateY(4px)')
    expect(css).not.toContain('rgb(255 255 255 / 90%)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
