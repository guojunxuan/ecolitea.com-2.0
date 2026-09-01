import { cleanup, render, waitFor } from '@testing-library/react'
import Link from 'next/link'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCachedGlobalMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({
  getCachedGlobal: getCachedGlobalMock,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

import { Footer } from '@/Footer/Component'
import { HeaderClient } from '@/Header/Component.client'
import { Header } from '@/Header/Component'
import { Logo } from '@/components/Logo/Logo'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { selectLogo } from '@/components/Logo/selectLogo'
import type { LogoImage } from '@/components/Logo/types'
import type { BrandAsset, Footer as FooterData, Header as HeaderData } from '@/payload-types'
import { HeaderThemeProvider } from '@/providers/HeaderTheme'

const brandAsset = (overrides: Partial<BrandAsset> = {}): BrandAsset => ({
  id: 'brand-asset-id',
  alt: 'Ecolitea',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T01:02:03.000Z',
  url: '/api/brand-assets/file/ecolitea.svg',
  width: 1302,
  height: 296,
  ...overrides,
})

const primaryLogo: LogoImage = {
  src: '/primary.svg',
  alt: 'Primary logo',
  width: 1302,
  height: 296,
}

const inverseLogo: LogoImage = {
  src: '/inverse.svg',
  alt: 'Inverse logo',
  width: 1302,
  height: 296,
}

const headerData: HeaderData = { id: 'header', navItems: [] }
const footerData: FooterData = { id: 'footer', navItems: [] }

const findElementByType = (
  node: React.ReactNode,
  type: React.ElementType,
): React.ReactElement<Record<string, unknown>> | null => {
  if (!React.isValidElement(node)) return null
  if (node.type === type) return node as React.ReactElement<Record<string, unknown>>

  const { children } = node.props as { children?: React.ReactNode }

  for (const child of React.Children.toArray(children)) {
    const match = findElementByType(child, type)
    if (match) return match
  }

  return null
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-theme')
  getCachedGlobalMock.mockReset()
})

describe('resolveBrandAsset', () => {
  it('returns null for an unexpanded relationship ID', () => {
    expect(resolveBrandAsset('brand-asset-id')).toBeNull()
  })

  it('returns null when a populated asset has no URL', () => {
    expect(resolveBrandAsset(brandAsset({ url: null }))).toBeNull()
  })

  it('resolves a populated asset into cache-tagged presentation data', () => {
    expect(resolveBrandAsset(brandAsset())).toEqual({
      src: '/api/brand-assets/file/ecolitea.svg?2026-09-01T01%3A02%3A03.000Z',
      alt: 'Ecolitea',
      width: 1302,
      height: 296,
    })
  })

  it('uses stable intrinsic dimensions when metadata is missing or non-positive', () => {
    expect(resolveBrandAsset(brandAsset({ width: 0, height: -1 }))).toMatchObject({
      width: 1302,
      height: 296,
    })
  })

  it('derives height from valid width when height metadata is missing', () => {
    expect(resolveBrandAsset(brandAsset({ width: 1000, height: null }))).toMatchObject({
      width: 1000,
      height: 227,
    })
  })

  it('derives width from valid height when width metadata is missing', () => {
    expect(resolveBrandAsset(brandAsset({ width: null, height: 200 }))).toMatchObject({
      width: 880,
      height: 200,
    })
  })
})

describe('Logo', () => {
  it('renders the supplied native image attributes and responsive classes', () => {
    const image: LogoImage = {
      src: '/ecolitea.svg',
      alt: 'Ecolitea',
      width: 1302,
      height: 296,
    }
    const { getByRole } = render(
      <Logo image={image} loading="eager" priority="high" className="h-7 sm:h-8 lg:h-10" />,
    )

    const logo = getByRole('img')

    expect(logo.getAttribute('src')).toBe('/ecolitea.svg')
    expect(logo.getAttribute('alt')).toBe('Ecolitea')
    expect(logo.getAttribute('width')).toBe('1302')
    expect(logo.getAttribute('height')).toBe('296')
    expect(logo.getAttribute('loading')).toBe('eager')
    expect(logo.getAttribute('fetchpriority')).toBe('high')
    expect(logo.getAttribute('decoding')).toBe('async')
    expect(logo.className).toBe('block w-auto max-w-full h-7 sm:h-8 lg:h-10')
  })

  it('renders nothing when image data is missing', () => {
    const { container } = render(<Logo image={null} />)

    expect(container.firstChild).toBeNull()
  })
})

describe('selectLogo', () => {
  it('selects the primary logo in normal mode', () => {
    expect(selectLogo(primaryLogo, inverseLogo, false)).toBe(primaryLogo)
  })

  it('selects the inverse logo in inverse mode', () => {
    expect(selectLogo(primaryLogo, inverseLogo, true)).toBe(inverseLogo)
  })

  it('falls back to the primary logo when inverse artwork is unavailable', () => {
    expect(selectLogo(primaryLogo, null, true)).toBe(primaryLogo)
  })

  it('returns null in normal mode when primary artwork is unavailable', () => {
    expect(selectLogo(null, inverseLogo, false)).toBeNull()
  })
})

describe('branding integration', () => {
  const primaryAsset = brandAsset({
    alt: 'Primary brand',
    url: '/api/brand-assets/file/primary.svg',
  })
  const inverseAsset = brandAsset({
    alt: 'Inverse brand',
    id: 'inverse-brand-asset-id',
    url: '/api/brand-assets/file/inverse.svg',
  })

  const useGlobalFixtures = ({
    logo = primaryAsset,
    logoDark = inverseAsset,
  }: {
    logo?: BrandAsset | string | null
    logoDark?: BrandAsset | string | null
  } = {}) => {
    getCachedGlobalMock.mockImplementation((slug: string, depth: number) => {
      if (depth !== 1) throw new Error(`Expected depth 1 for ${slug}`)

      const globals = {
        footer: footerData,
        header: headerData,
        'site-settings': {
          id: 'site-settings',
          siteName: 'Ecolitea',
          logo,
          logoDark,
        },
      }

      return async () => globals[slug as keyof typeof globals]
    })
  }

  it('passes resolved Site Settings logos through the Header server boundary', async () => {
    useGlobalFixtures()

    const header = await Header()

    expect(header.props).toMatchObject({
      data: headerData,
      logo: {
        src: '/api/brand-assets/file/primary.svg?2026-09-01T01%3A02%3A03.000Z',
        alt: 'Primary brand',
        width: 1302,
        height: 296,
      },
      logoDark: {
        src: '/api/brand-assets/file/inverse.svg?2026-09-01T01%3A02%3A03.000Z',
        alt: 'Inverse brand',
        width: 1302,
        height: 296,
      },
    })
  })

  it('renders the inverse Site Settings logo from the Footer server boundary', async () => {
    useGlobalFixtures()

    const footer = await Footer()
    const logo = findElementByType(footer, Logo)

    expect(logo?.props.image).toEqual({
      src: '/api/brand-assets/file/inverse.svg?2026-09-01T01%3A02%3A03.000Z',
      alt: 'Inverse brand',
      width: 1302,
      height: 296,
    })
    expect(logo?.props.className).toBe('h-7 sm:h-8 lg:h-10')
  })

  it('switches the Header presentation to the inverse logo for a dark local theme', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')

    const { getByRole } = render(
      <HeaderThemeProvider>
        <HeaderClient data={headerData} logo={primaryLogo} logoDark={inverseLogo} />
      </HeaderThemeProvider>,
    )

    await waitFor(() => {
      expect(getByRole('img').getAttribute('src')).toBe('/inverse.svg')
    })

    const logo = getByRole('img')
    expect(logo.getAttribute('loading')).toBe('eager')
    expect(logo.getAttribute('fetchpriority')).toBe('high')
    expect(logo.className).toBe('block w-auto max-w-full h-7 sm:h-8 lg:h-10')
    expect(logo.className).not.toContain('invert')
  })

  it('omits the Header home link when no logo presentation data resolves', () => {
    const { container } = render(
      <HeaderThemeProvider>
        <HeaderClient data={headerData} logo={null} logoDark={null} />
      </HeaderThemeProvider>,
    )

    expect(container.querySelector('a[href="/"]')).toBeNull()
  })

  it('omits the Footer home link when no logo presentation data resolves', async () => {
    useGlobalFixtures({ logo: 'unexpanded-brand-id', logoDark: null })

    const footer = await Footer()

    expect(findElementByType(footer, Link)).toBeNull()
  })
})
