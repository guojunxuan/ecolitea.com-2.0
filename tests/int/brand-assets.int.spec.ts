import { describe, expect, it } from 'vitest'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { BrandAssets } from '@/collections/BrandAssets'

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

  it('is registered in the root Payload config', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const config = await configPromise

    expect(config.collections.some((collection) => collection.slug === BrandAssets.slug)).toBe(true)
  })

  it('uses the R2 S3 storage adapter for media and brand assets', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const config = await configPromise
    const uploadStorage = Object.fromEntries(
      config.collections
        .filter(({ slug }) => ['media', BrandAssets.slug].includes(slug))
        .map(({ slug, upload }) => [
          slug,
          typeof upload === 'object'
            ? {
                adapter: upload.adapter,
                disableLocalStorage: upload.disableLocalStorage,
              }
            : upload,
        ]),
    )

    expect(uploadStorage).toMatchObject({
      media: {
        adapter: 's3',
        disableLocalStorage: true,
      },
      [BrandAssets.slug]: {
        adapter: 's3',
        disableLocalStorage: true,
      },
    })
  })
})
