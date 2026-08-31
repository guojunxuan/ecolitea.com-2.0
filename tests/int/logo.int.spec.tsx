import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { Logo } from '@/components/Logo/Logo'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import type { LogoImage } from '@/components/Logo/types'
import type { BrandAsset } from '@/payload-types'

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

afterEach(cleanup)

describe('integration test configuration', () => {
  it('collects both TypeScript and TSX integration specs', () => {
    const configSource = readFileSync('vitest.config.mts', 'utf8')

    expect(configSource).toContain("include: ['tests/int/**/*.int.spec.{ts,tsx}']")
  })
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
      <Logo image={image} loading="eager" priority="high" className="max-h-12" />,
    )

    const logo = getByRole('img')

    expect(logo.getAttribute('src')).toBe('/ecolitea.svg')
    expect(logo.getAttribute('alt')).toBe('Ecolitea')
    expect(logo.getAttribute('width')).toBe('1302')
    expect(logo.getAttribute('height')).toBe('296')
    expect(logo.getAttribute('loading')).toBe('eager')
    expect(logo.getAttribute('fetchpriority')).toBe('high')
    expect(logo.getAttribute('decoding')).toBe('async')
    expect(logo.className).toContain('block h-auto w-auto max-w-full')
    expect(logo.className).toContain('max-h-12')
  })

  it('renders nothing when image data is missing', () => {
    const { container } = render(<Logo image={null} />)

    expect(container.firstChild).toBeNull()
  })
})
