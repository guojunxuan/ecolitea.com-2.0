import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { HeaderNavigationData } from '@/Header/Nav/types'
import type { BrandAsset, Header as HeaderData, SiteSettings } from '@/payload-types'

const getCachedHeaderMock = vi.hoisted(() => vi.fn())
const getCachedSiteSettingsMock = vi.hoisted(() => vi.fn())
const adaptHeaderNavigationMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({
  getCachedHeader: getCachedHeaderMock,
  getCachedSiteSettings: getCachedSiteSettingsMock,
}))
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
  address: 'Shanghai, China',
  id: 'site-settings',
  legalCompanyName: 'Ecolitea Limited',
  siteName: 'Ecolitea',
  siteDescription: 'Sustainable tea systems.',
  logo: logoAsset,
  newsletter: {
    buttonLabel: 'Subscribe',
    emailPlaceholder: 'Email address',
  },
  phone: '+86 21 5555 5555',
  salesEmail: 'sales@example.com',
  tagline: 'Sustainable tea.',
}

afterEach(() => {
  cleanup()
  getCachedHeaderMock.mockReset()
  getCachedSiteSettingsMock.mockReset()
  adaptHeaderNavigationMock.mockReset()
})

describe('Header server boundary', () => {
  it('loads both canonical readers concurrently and adapts Header data exactly once', async () => {
    const pending = new Map<string, (value: unknown) => void>()
    const started: string[] = []
    getCachedHeaderMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('header')
          pending.set('header', resolve)
        }),
    )
    getCachedSiteSettingsMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          started.push('site-settings')
          pending.set('site-settings', resolve)
        }),
    )
    adaptHeaderNavigationMock.mockReturnValue(navigation)

    const result = Header()

    expect(started).toEqual(['header', 'site-settings'])
    pending.get('header')?.(headerData)
    pending.get('site-settings')?.(siteSettings)

    const element = await result
    expect(getCachedHeaderMock).toHaveBeenCalledOnce()
    expect(getCachedSiteSettingsMock).toHaveBeenCalledOnce()
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
    getCachedHeaderMock.mockResolvedValue(headerData)
    getCachedSiteSettingsMock.mockResolvedValue({
      ...siteSettings,
      logo: 'unexpanded-relationship-id',
    })
    adaptHeaderNavigationMock.mockReturnValue(navigation)

    const element = await Header()

    expect(element.props.logo).toBeNull()
    expect(element.props.siteName).toBe('Ecolitea')
  })
})

describe('HeaderClient', () => {
  it('renders Site Name as the home brand when no logo resolves', () => {
    render(<HeaderClient {...navigation} logo={null} siteName="Ecolitea" />)

    const brandLinks = screen.getAllByRole('link', { name: 'Ecolitea' })
    expect(brandLinks).toHaveLength(2)
    expect(brandLinks.every((link) => link.getAttribute('href') === '/')).toBe(true)
    expect(brandLinks[0]?.className).toContain('desktopBrandLink')
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Component.module.css'), 'utf8')
    expect(css).toMatch(
      /\.desktopBrandFallback\s*\{[^}]*font-size:\s*1rem;[^}]*font-weight:\s*600;[^}]*letter-spacing:\s*-0\.025em;[^}]*line-height:\s*1\.5;/s,
    )
    expect(screen.getAllByRole('link', { name: 'Search' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeTruthy()
  })

  it('starts transparent and changes its surface only after the 30px threshold', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true })
    const { container } = render(<HeaderClient {...navigation} logo={null} siteName="Ecolitea" />)
    const surface = container.querySelector('[data-scrolled]') as HTMLElement

    expect(surface.getAttribute('data-scrolled')).toBe('false')
    expect(surface.getAttribute('data-menu-open')).toBe('false')
    expect(surface.parentElement?.className).not.toContain('h-[var(--header-height)]')

    window.scrollY = 24
    fireEvent.scroll(window)
    expect(surface.getAttribute('data-scrolled')).toBe('false')

    window.scrollY = 31
    fireEvent.scroll(window)
    expect(surface.getAttribute('data-scrolled')).toBe('true')
  })

  it('reports desktop and mobile navigation open state on the shared surface', () => {
    const desktopNavigation: HeaderNavigationData = {
      menuCta: null,
      navItems: [
        {
          content: [
            {
              heading: 'Explore',
              id: 'explore-links',
              links: [],
              type: 'linkGroup',
            },
          ],
          id: 'products',
          label: 'Products',
          link: null,
          navigationType: 'dropdown',
        },
      ],
    }
    const { container } = render(
      <HeaderClient {...desktopNavigation} logo={null} siteName="Ecolitea" />,
    )
    const surface = container.querySelector('[data-scrolled]') as HTMLElement

    fireEvent.click(screen.getByRole('button', { name: 'Products' }))
    expect(surface.getAttribute('data-menu-open')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }))
    expect(surface.getAttribute('data-menu-open')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(surface.getAttribute('data-menu-open')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
    expect(surface.getAttribute('data-menu-open')).toBe('false')
  })

  it('defines translucent desktop and solid mobile surface states in scoped CSS', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Component.module.css'), 'utf8')

    expect(css).toContain('rgb(255 255 255 / 90%)')
    expect(css).toContain("[data-menu-open='true']")
    expect(css).toContain("[data-scrolled='true']")
    expect(css).toContain('@media (width <= 1170px)')
    expect(css).toContain('rgb(255 255 255 / 90%)')
  })

  it('matches the reference desktop Header logo frame without changing the mobile logo', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/Header/Component.module.css'), 'utf8')
    const source = readFileSync(resolve(process.cwd(), 'src/Header/Component.client.tsx'), 'utf8')
    const desktopLogo = css.match(/\.desktopLogo\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(desktopLogo).toContain('height: 2.4375rem')
    expect(desktopLogo).toContain('width: 8.125rem')
    expect(source).toContain('className={styles.desktopLogo}')
  })
})
