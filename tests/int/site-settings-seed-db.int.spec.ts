import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildConfig, getPayload, type File, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BrandAssets } from '@/collections/BrandAssets'
import { SocialPlatforms } from '@/collections/SocialPlatforms'
import { seedSocialSettings } from '@/endpoints/seed'
import { SiteSettings } from '@/SiteSettings/config'

const svgUpload = (name: string): File => {
  const source =
    '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'
  const data = Buffer.from(source)
  return { name, data, mimetype: 'image/svg+xml', size: data.byteLength }
}

const withTempUpload = async <T>(file: File, callback: (file: File) => Promise<T>) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ecolitea-seed-test-upload-'))
  const tempFilePath = path.join(directory, file.name)
  await writeFile(tempFilePath, file.data)
  try {
    return await callback({ ...file, data: Buffer.alloc(0), tempFilePath })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

describe('seedSocialSettings database lifecycle', () => {
  let payload: Payload | undefined
  let uploadDirectory: string | undefined

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'ecolitea-seed-lifecycle-'))
    const databaseName = `ecolitea2-seed-lifecycle-${randomUUID()}`
    const config = await buildConfig({
      collections: [
        {
          ...BrandAssets,
          upload: { ...(typeof BrandAssets.upload === 'object' ? BrandAssets.upload : {}), staticDir: uploadDirectory },
        },
        SocialPlatforms,
        { slug: 'pages', fields: [{ name: 'title', type: 'text' }] },
      ],
      db: mongooseAdapter({
        connectOptions: { serverSelectionTimeoutMS: 3_000 },
        url: `mongodb://127.0.0.1:27017/${databaseName}`,
      }),
      globals: [{ ...SiteSettings, hooks: {} }],
      secret: 'seed-lifecycle-test-secret-that-is-at-least-32-characters',
      sharp,
    })

    payload = await getPayload({ config, key: databaseName })
  }, 15_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
    if (uploadDirectory) await rm(uploadDirectory, { force: true, recursive: true })
  })

  it('persists a fresh valid seed and preserves custom branding and unrelated records on reseed', async () => {
    if (!payload) throw new Error('Payload did not initialize')

    const firstSettings = await seedSocialSettings(payload)
    const firstPersistedSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
    const firstAssets = await payload.find({ collection: 'brand-assets', limit: 20 })
    const firstPlatforms = await payload.find({ collection: 'social-platforms', depth: 0, limit: 20 })

    expect(firstSettings.siteName).toBe('Ecolitea')
    expect(firstSettings.logo).toBeTruthy()
    expect(firstSettings.socialLinks).toHaveLength(3)
    expect(firstAssets.docs).toHaveLength(4)
    expect(firstAssets.docs.every((asset) => asset.mimeType === 'image/svg+xml')).toBe(true)
    expect(firstPlatforms.docs).toHaveLength(3)
    expect(
      firstPlatforms.docs.every((platform) =>
        firstAssets.docs.some((asset) => asset.id === platform.icon),
      ),
    ).toBe(true)
    expect(
      firstSettings.socialLinks?.every(
        ({ platform }) => typeof platform === 'object' && platform.platform.length > 0,
      ),
    ).toBe(true)
    expect(
      firstPersistedSettings.socialLinks?.map(({ platform }) => platform).sort(),
    ).toEqual(firstPlatforms.docs.map(({ id }) => id).sort())

    const customLogo = await withTempUpload(
      svgUpload(`customer-logo-${randomUUID()}.svg`),
      (file) =>
        payload!.create({
          collection: 'brand-assets',
          data: { alt: 'Customer-owned logo' },
          file,
        }),
    )
    const unrelatedPlatform = await payload.create({
      collection: 'social-platforms',
      data: { icon: customLogo.id, platform: `Customer Network ${randomUUID()}` },
    })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { logo: customLogo.id, siteName: 'Customer Name' },
    })

    const assetCountBeforeReseed = await payload.count({ collection: 'brand-assets' })
    const platformCountBeforeReseed = await payload.count({ collection: 'social-platforms' })
    const secondSettings = await seedSocialSettings(payload)
    const secondPersistedSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })

    expect(await payload.count({ collection: 'brand-assets' })).toEqual(assetCountBeforeReseed)
    expect(await payload.count({ collection: 'social-platforms' })).toEqual(
      platformCountBeforeReseed,
    )
    expect(secondSettings.siteName).toBe('Customer Name')
    expect(secondPersistedSettings).toMatchObject({
      logo: customLogo.id,
      siteName: 'Customer Name',
    })
    expect(await payload.findByID({ collection: 'brand-assets', id: customLogo.id })).toBeTruthy()
    expect(
      await payload.findByID({ collection: 'social-platforms', id: unrelatedPlatform.id }),
    ).toBeTruthy()
    expect(secondSettings.socialLinks).toHaveLength(3)
  }, 15_000)
})
