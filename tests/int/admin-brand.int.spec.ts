import { describe, expect, it } from 'vitest'
import { resolveAdminBrand } from '@/components/admin/brand/resolveAdminBrand'
import type { SiteAsset } from '@/payload-types'

const asset: SiteAsset = {
  id: 'asset',
  alt: 'Site mark',
  url: '/assets/mark.svg',
  mimeType: 'image/svg+xml',
  width: 100,
  height: 24,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('resolveAdminBrand', () => {
  it('uses a neutral brand when settings have never been saved', () => {
    expect(resolveAdminBrand()).toEqual({ name: 'Admin' })
    expect(resolveAdminBrand({ siteName: '  ' })).toEqual({ name: 'Admin' })
  })

  it('falls back to the trimmed site name when asset relationships are unresolved', () => {
    expect(resolveAdminBrand({ siteName: '  Tea Studio  ', logo: 'id', favicon: null }))
      .toEqual({ name: 'Tea Studio' })
  })

  it('resolves both populated relationships while retaining the name for fallback and accessibility', () => {
    expect(resolveAdminBrand({ siteName: 'Tea Studio', logo: asset, favicon: asset })).toEqual({
      name: 'Tea Studio',
      logo: { src: expect.stringContaining('/assets/mark.svg'), alt: 'Site mark', width: 100, height: 24 },
      icon: { url: expect.stringContaining('/assets/mark.svg'), type: 'image/svg+xml' },
    })
  })

  it('handles each graphic independently', () => {
    expect(resolveAdminBrand({ favicon: asset })).toMatchObject({ name: 'Admin', icon: { type: 'image/svg+xml' } })
    expect(resolveAdminBrand({ logo: asset }).icon).toBeUndefined()
  })
})
