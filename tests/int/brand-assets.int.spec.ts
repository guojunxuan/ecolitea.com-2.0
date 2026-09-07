import { afterAll, describe, expect, it, vi } from 'vitest'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { BrandAssets } from '@/collections/BrandAssets'

const testR2PublicURL = 'https://media.example.invalid'

vi.stubEnv('R2_PUBLIC_URL', `${testR2PublicURL}/`)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('Brand Assets Collection', () => {
  it('is a hidden native upload collection for supported brand file types', () => {
    expect(BrandAssets.slug).toBe('brand-assets')
    expect(BrandAssets.admin?.hidden).toBe(true)
    expect(BrandAssets.access).toMatchObject({
      create: authenticated,
      delete: authenticated,
      read: anyone,
      update: authenticated,
    })
    expect(BrandAssets.upload).toMatchObject({
      mimeTypes: [
        'image/svg+xml',
        'image/png',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ],
    })
  })

  it(
    'is registered in the root Payload config',
    async () => {
      const { default: configPromise } = await import('@/payload.config')
      const config = await configPromise

      expect(config.collections.some((collection) => collection.slug === BrandAssets.slug)).toBe(
        true,
      )
    },
    15_000,
  )

  it('builds public R2 URLs with and without a collection prefix', async () => {
    const { generateR2FileURL } = await import('@/plugins')

    expect(generateR2FileURL({ filename: 'logo.svg', prefix: 'brand-assets' })).toBe(
      `${testR2PublicURL}/brand-assets/logo.svg`,
    )
    expect(generateR2FileURL({ filename: 'favicon.ico' })).toBe(
      `${testR2PublicURL}/favicon.ico`,
    )
    expect(generateR2FileURL({ filename: 'favicon.ico', prefix: '' })).toBe(
      `${testR2PublicURL}/favicon.ico`,
    )
  })

  it('shares the public R2 collection options between media and brand assets', async () => {
    const { generateR2FileURL, r2StorageCollections } = await import('@/plugins')

    expect(Object.keys(r2StorageCollections).sort()).toEqual(['brand-assets', 'media'])
    expect(r2StorageCollections.media).toBe(r2StorageCollections['brand-assets'])
    expect(r2StorageCollections.media).toMatchObject({
      disablePayloadAccessControl: true,
      generateFileURL: generateR2FileURL,
    })
  })
})
