import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DesktopNav } from '@/Header/Nav/DesktopNav'
import type { HeaderNavigationData, HeaderNavigationItem } from '@/Header/Nav/types'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const link = (label: string, href = `/${label.toLowerCase().replaceAll(' ', '-')}`) => ({ href, label, newTab: false, type: 'custom' as const })
const panel = (id: string, label: string) => ({ id, type: 'linkGroup' as const, heading: label, links: [{ id: `${id}-link`, link: link(`${label} overview`) }] })
const navigation: HeaderNavigationData = {
  menuCta: link('Talk to sales', '/contact'),
  navItems: [
    { content: null, id: 'pricing', label: 'Pricing', link: link('Pricing'), navigationType: 'directLink' },
    { content: [panel('platform-panel', 'Platform')], id: 'platform', label: 'Platform', link: null, navigationType: 'dropdown' },
    { content: [panel('company-panel', 'Company')], id: 'company', label: 'Company', link: link('Company'), navigationType: 'directLinkAndDropdown' },
  ],
}

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = []
  constructor(private readonly callback: ResizeObserverCallback) { ResizeObserverMock.instances.push(this) }
  observe = vi.fn()
  disconnect = vi.fn()
  emit() { this.callback([], this as unknown as ResizeObserver) }
}

describe('DesktopNav', () => {
  beforeEach(() => {
    pathname = '/'; ResizeObserverMock.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('keeps all primary entries in source order and has no More control', () => {
    render(<DesktopNav {...navigation} />)
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link').map((node) => node.textContent)).toEqual(['Pricing', 'Company'])
    expect(screen.getByRole('button', { name: 'Platform menu' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /More menu/i })).toBeNull()
  })

  it('opens and switches panels immediately on click and pointer movement', () => {
    render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform menu' }); fireEvent.click(platform)
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Company menu' }))
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Company menu' })).toBeTruthy()
  })

  it('keeps the panel open while moving from a trigger into the panel', () => {
    render(<header><DesktopNav {...navigation} /></header>)
    const platform = screen.getByRole('button', { name: 'Platform menu' }); fireEvent.click(platform)
    const panelRegion = screen.getByRole('region', { name: 'Platform menu' })
    fireEvent.pointerLeave(platform, { relatedTarget: panelRegion })
    expect(screen.getByRole('region', { name: 'Platform menu' })).toBeTruthy()
  })

  it('makes an explicit click-to-close win while the pointer remains over the trigger', () => {
    render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform menu' }); fireEvent.click(platform); fireEvent.click(platform)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    fireEvent.pointerEnter(platform)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('closes on Escape, outside activation, and route changes', () => {
    const { rerender } = render(<DesktopNav {...navigation} />)
    const platform = screen.getByRole('button', { name: 'Platform menu' }); fireEvent.click(platform); fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    fireEvent.click(platform); fireEvent.pointerDown(document.body); expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
    fireEvent.click(platform); pathname = '/new-route'; rerender(<DesktopNav {...navigation} />)
    expect(screen.queryByRole('region', { name: 'Platform menu' })).toBeNull()
  })

  it('renders hybrid destination and disclosure as separate controls', () => {
    render(<DesktopNav {...navigation} />)
    expect(screen.getByRole('link', { name: 'Company' }).getAttribute('href')).toBe('/company')
    expect(screen.getByRole('button', { name: 'Company menu' })).toBeTruthy()
  })

  it('supports the normalized navigation item contract without legacy dropdown fields', () => {
    const item: HeaderNavigationItem = navigation.navItems[1]!
    expect('dropdown' in item).toBe(false); expect(item.content[0]?.type).toBe('linkGroup')
  })

  it('shows boundary-preserving controls only when the primary strip overflows', async () => {
    const { container, rerender } = render(<DesktopNav {...navigation} />)
    const strip = container.querySelector('[data-overflow]') as HTMLElement
    Object.defineProperties(strip, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 700 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    })
    strip.scrollTo = vi.fn()
    ResizeObserverMock.instances[0]?.emit()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Scroll navigation left' }) as HTMLButtonElement).disabled).toBe(true))
    expect((screen.getByRole('button', { name: 'Scroll navigation right' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Scroll navigation right' }))
    expect(strip.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) }))

    Object.defineProperties(strip, { clientWidth: { configurable: true, value: 1000 } })
    ResizeObserverMock.instances[0]?.emit()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Scroll navigation left' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Scroll navigation right' })).toBeNull()
    rerender(<DesktopNav {...navigation} />)
  })
})
