import { afterAll, describe, expect, it, vi } from 'vitest'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { SiteAssets, validateSvgSiteAsset } from '@/collections/SiteAssets'

const testR2PublicURL = 'https://media.example.invalid'

vi.stubEnv('R2_PUBLIC_URL', `${testR2PublicURL}/`)

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('Site Assets Collection', () => {
  it('is a hidden native upload collection for supported brand file types', () => {
    expect(SiteAssets.slug).toBe('site-assets')
    expect(SiteAssets.labels).toEqual({ singular: 'Site Asset', plural: 'Site Assets' })
    expect(SiteAssets.admin?.hidden).toBe(true)
    expect(SiteAssets.access).toMatchObject({
      create: authenticated,
      delete: authenticated,
      read: anyone,
      update: authenticated,
    })
    expect(SiteAssets.fields).toContainEqual({ name: 'alt', type: 'text', required: true })
    expect(SiteAssets.upload).toMatchObject({
      mimeTypes: [
        'image/svg+xml',
        'image/png',
        'image/x-icon',
        'image/vnd.microsoft.icon',
      ],
    })
  })

  it('validates populated SVG assets and rejects other MIME types without a lookup', async () => {
    const findByID = vi.fn()
    const options = { req: { payload: { findByID } } } as never
    await expect(validateSvgSiteAsset({ id: 'svg', mimeType: 'image/svg+xml' } as never, options)).resolves.toBe(true)
    await expect(validateSvgSiteAsset({ id: 'png', mimeType: 'image/png' } as never, options)).resolves.toBe('Icons must be SVG files.')
    expect(findByID).not.toHaveBeenCalled()
  })

  it(
    'is registered in the root Payload config',
    async () => {
      const { default: configPromise } = await import('@/payload.config')
      const config = await configPromise

      expect(config.collections.some((collection) => collection.slug === SiteAssets.slug)).toBe(
        true,
      )
    },
    15_000,
  )

  it('builds public R2 URLs with and without a collection prefix', async () => {
    const { generateR2FileURL } = await import('@/plugins')

    expect(generateR2FileURL({ filename: 'logo.svg', prefix: 'site-assets' })).toBe(
      `${testR2PublicURL}/site-assets/logo.svg`,
    )
    expect(generateR2FileURL({ filename: 'favicon.ico' })).toBe(
      `${testR2PublicURL}/favicon.ico`,
    )
    expect(generateR2FileURL({ filename: 'favicon.ico', prefix: '' })).toBe(
      `${testR2PublicURL}/favicon.ico`,
    )
  })

  it('shares the public R2 collection options between media and site assets', async () => {
    const { generateR2FileURL, r2StorageCollections } = await import('@/plugins')

    expect(Object.keys(r2StorageCollections).sort()).toEqual(['media', 'site-assets'])
    expect(r2StorageCollections.media).toBe(r2StorageCollections['site-assets'])
    expect(r2StorageCollections.media).toMatchObject({
      disablePayloadAccessControl: true,
      generateFileURL: generateR2FileURL,
    })
  })
})
