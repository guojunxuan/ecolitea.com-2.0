import { cleanup, render } from '@testing-library/react'
import Link from 'next/link'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getCachedHeaderMock = vi.hoisted(() => vi.fn())
const getCachedFooterMock = vi.hoisted(() => vi.fn())
const getCachedSiteSettingsMock = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/getGlobals', () => ({
  getCachedHeader: getCachedHeaderMock,
  getCachedFooter: getCachedFooterMock,
  getCachedSiteSettings: getCachedSiteSettingsMock,
}))
vi.mock('@/components/RichText', () => ({ default: () => null }))

import { Footer } from '@/Footer/Component'
import { HeaderClient } from '@/Header/Component.client'
import { Header } from '@/Header/Component'
import { Logo } from '@/components/Logo/Logo'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { resolveFavicon } from '@/components/Logo/resolveFavicon'
import { selectLogo } from '@/components/Logo/selectLogo'
import type { LogoImage } from '@/components/Logo/types'
import type { BrandAsset, Footer as FooterData, Header as HeaderData } from '@/payload-types'
import { buildSiteMetadata } from '@/utilities/buildSiteMetadata'

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
const footerData: FooterData = { id: 'footer', columns: [] }

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
  getCachedHeaderMock.mockReset()
  getCachedFooterMock.mockReset()
  getCachedSiteSettingsMock.mockReset()
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

  it('preserves the configured remote URL for an R2-backed brand asset', () => {
    expect(
      resolveBrandAsset(
        brandAsset({
          filename: 'white logo.svg',
          url: 'https://media.ecolitea.com/white logo.svg',
        }),
      ),
    ).toMatchObject({
      src: 'https://media.ecolitea.com/white logo.svg?2026-09-01T01%3A02%3A03.000Z',
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

describe('resolveFavicon', () => {
  it('resolves a populated PNG asset with its MIME type and cache-tagged URL', () => {
    expect(
      resolveFavicon(
        brandAsset({
          mimeType: 'image/png',
          url: '/api/brand-assets/file/favicon.png',
        }),
      ),
    ).toEqual({
      url: '/api/brand-assets/file/favicon.png?2026-09-01T01%3A02%3A03.000Z',
      type: 'image/png',
    })
  })

  it('returns null for a missing or unexpanded relationship', () => {
    expect(resolveFavicon(undefined)).toBeNull()
    expect(resolveFavicon('brand-asset-id')).toBeNull()
    expect(resolveFavicon(brandAsset({ url: null }))).toBeNull()
  })
})

describe('buildSiteMetadata', () => {
  it('uses a configured favicon and preserves the existing root metadata', () => {
    const metadata = buildSiteMetadata({
      url: '/api/brand-assets/file/favicon.png?cache-tag',
      type: 'image/png',
    })

    expect(metadata.icons).toEqual({
      icon: [
        {
          url: '/api/brand-assets/file/favicon.png?cache-tag',
          type: 'image/png',
        },
      ],
    })
    expect(metadata.metadataBase).toEqual(new URL('http://localhost:3000'))
    expect(metadata.openGraph).toBeDefined()
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      creator: '@payloadcms',
    })
  })

  it('uses the existing static favicon pair when no configured asset resolves', () => {
    expect(buildSiteMetadata(null).icons).toEqual({
      icon: [
        { url: '/favicon.ico', sizes: '32x32' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
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
    const siteSettings = {
      id: 'site-settings',
      siteName: 'Ecolitea',
      logo,
      logoDark,
    }

    getCachedHeaderMock.mockResolvedValue(headerData)
    getCachedFooterMock.mockResolvedValue(footerData)
    getCachedSiteSettingsMock.mockResolvedValue(siteSettings)
  }

  it('passes resolved Site Settings logos through the Header server boundary', async () => {
    useGlobalFixtures()

    const header = await Header()

    expect(header.props).toMatchObject({
      logo: {
        src: '/api/brand-assets/file/primary.svg?2026-09-01T01%3A02%3A03.000Z',
        alt: 'Primary brand',
        width: 1302,
        height: 296,
      },
      siteName: 'Ecolitea',
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
    expect(logo?.props.className).toBeTruthy()
  })

  it('keeps the Header home link from shrinking the logo on narrow screens', () => {
    const { getByRole } = render(
      <HeaderClient logo={primaryLogo} menuCta={null} navItems={[]} siteName="Ecolitea" />,
    )

    const homeLink = getByRole('link', { name: 'Primary logo' })

    expect(homeLink.className).toBe('shrink-0')
    expect(homeLink.getAttribute('href')).toBe('/')
  })

  it('falls back to Site Name when no Header logo presentation data resolves', () => {
    const { getByRole } = render(
      <HeaderClient logo={null} menuCta={null} navItems={[]} siteName="Ecolitea" />,
    )

    expect(getByRole('link', { name: 'Ecolitea' }).getAttribute('href')).toBe('/')
  })

  it('omits the Footer home link when no logo presentation data resolves', async () => {
    useGlobalFixtures({ logo: 'unexpanded-brand-id', logoDark: null })

    const footer = await Footer()

    expect(findElementByType(footer, Link)).toBeNull()
  })

  it('falls back to the primary logo in the Footer when inverse artwork is unavailable', async () => {
    useGlobalFixtures({ logoDark: null })

    const footer = await Footer()
    const logo = findElementByType(footer, Logo)

    expect(logo?.props.image).toMatchObject({
      src: '/api/brand-assets/file/primary.svg?2026-09-01T01%3A02%3A03.000Z',
      alt: 'Primary brand',
    })
  })
})
