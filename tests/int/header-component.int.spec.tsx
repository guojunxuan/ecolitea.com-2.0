import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderNavigationData } from '@/Header/Nav/types'
import type { BrandAsset, Header as HeaderData, SiteSettings } from '@/payload-types'

const getCachedGlobalMock = vi.hoisted(() => vi.fn())
const adaptHeaderNavigationMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({ getCachedGlobal: getCachedGlobalMock }))
vi.mock('@/Header/Nav/adaptNavigation', () => ({
  adaptHeaderNavigation: adaptHeaderNavigationMock,
}))
vi.mock('@/components/RichText', () => ({ default: () => null }))

import { HeaderClient } from '@/Header/Component.client'
import { Header } from '@/Header/Component'

const headerData: HeaderData = { id: 'header', navItems: [] }
const navigation: HeaderNavigationData = { menuCta: null, navItems: [] }
const logoAsset: BrandAsset = {
  alt: 'Ecolitea mark',
  createdAt: '2026-09-01T00:00:00.000Z',
  height: 296,
  id: 'logo',
  updatedAt: '2026-09-01T01:02:03.000Z',
  url: '/api/brand-assets/file/ecolitea.svg',
  width: 1302,
}
const siteSettings: SiteSettings = {
  id: 'site-settings',
  siteName: 'Ecolitea',
  logo: logoAsset,
}

afterEach(() => {
  cleanup()
  getCachedGlobalMock.mockReset()
  adaptHeaderNavigationMock.mockReset()
})

describe('Header server boundary', () => {
  it('loads both globals concurrently at depth 1 and adapts Header data exactly once', async () => {
    const pending = new Map<string, (value: unknown) => void>()
    const started: string[] = []
    getCachedGlobalMock.mockImplementation((slug: string, depth: number) => {
      expect(depth).toBe(1)
      return () =>
        new Promise((resolve) => {
          started.push(slug)
          pending.set(slug, resolve)
        })
    })
    adaptHeaderNavigationMock.mockReturnValue(navigation)

    const result = Header()

    expect(started).toEqual(['header', 'site-settings'])
    pending.get('header')?.(headerData)
    pending.get('site-settings')?.(siteSettings)

    const element = await result
    expect(getCachedGlobalMock.mock.calls).toEqual([
      ['header', 1],
      ['site-settings', 1],
    ])
    expect(adaptHeaderNavigationMock).toHaveBeenCalledOnce()
    expect(adaptHeaderNavigationMock).toHaveBeenCalledWith(headerData)
    expect(element.type).toBe(HeaderClient)
    expect(element.props).toEqual({
      logo: {
        alt: 'Ecolitea mark',
        height: 296,
        src: '/api/brand-assets/file/ecolitea.svg?2026-09-01T01%3A02%3A03.000Z',
        width: 1302,
      },
      menuCta: null,
      navItems: [],
      siteName: 'Ecolitea',
    })
    expect(() => JSON.stringify(element.props)).not.toThrow()
  })

  it('passes a null presentation logo while retaining Site Name as the brand fallback', async () => {
    getCachedGlobalMock.mockImplementation(
      (slug: string) => () =>
        Promise.resolve(
          slug === 'header' ? headerData : { ...siteSettings, logo: 'unexpanded-relationship-id' },
        ),
    )
    adaptHeaderNavigationMock.mockReturnValue(navigation)

    const element = await Header()

    expect(element.props.logo).toBeNull()
    expect(element.props.siteName).toBe('Ecolitea')
  })
})

describe('HeaderClient', () => {
  it('renders Site Name as the home brand when no logo resolves', () => {
    render(<HeaderClient {...navigation} logo={null} siteName="Ecolitea" />)

    expect(screen.getByRole('link', { name: 'Ecolitea' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeTruthy()
  })

  it('keeps a fixed light shell and only adds its divider cue after scrolling', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
    const { container } = render(<HeaderClient {...navigation} logo={null} siteName="Ecolitea" />)
    const surface = container.querySelector('[data-scrolled]')

    expect(surface?.getAttribute('data-scrolled')).toBe('false')
    expect(surface?.className).toContain('fixed')
    expect(surface?.className).toContain('bg-background')

    window.scrollY = 24
    fireEvent.scroll(window)

    expect(surface?.getAttribute('data-scrolled')).toBe('true')
    expect(surface?.className).toContain('border-b')
  })
})
