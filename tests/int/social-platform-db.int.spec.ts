import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildConfig, getPayload, type File, type GlobalConfig, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BrandAssets } from '@/collections/BrandAssets'
import { SocialPlatforms } from '@/collections/SocialPlatforms'
import { socialTab } from '@/SiteSettings/fields/social'

const upload = (name: string, mimetype = 'image/svg+xml'): File => {
  const data = mimetype === 'image/svg+xml'
    ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" />')
    : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
  return { data, mimetype, name, size: data.byteLength }
}

const withTempUpload = async <T>(file: File, callback: (file: File) => Promise<T>) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'social-platform-upload-'))
  const tempFilePath = path.join(directory, file.name)
  await writeFile(tempFilePath, file.data)
  try {
    return await callback({ ...file, data: Buffer.alloc(0), tempFilePath })
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

describe('Social Platform database contracts', () => {
  let payload: Payload
  let pngID: string
  let secondSVGID: string
  let uploadDirectory: string
  let svgID: string

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'social-platform-assets-'))
    const databaseName = `ecolitea2-social-platform-${randomUUID()}`
    const config = await buildConfig({
      collections: [
        { ...BrandAssets, upload: { ...(typeof BrandAssets.upload === 'object' ? BrandAssets.upload : {}), staticDir: uploadDirectory } },
        SocialPlatforms,
      ],
      db: mongooseAdapter({ connectOptions: { serverSelectionTimeoutMS: 3_000 }, url: `mongodb://127.0.0.1:27017/${databaseName}` }),
      globals: [
        {
          slug: 'site-settings',
          fields: socialTab.fields,
        } satisfies GlobalConfig,
      ],
      secret: 'social-platform-test-secret-that-is-at-least-32-characters',
      sharp,
    })
    payload = await getPayload({ config, key: databaseName })
    const asset = await withTempUpload(upload('icon.svg'), (file) =>
      payload.create({ collection: 'brand-assets', data: { alt: 'Icon' }, file }),
    )
    svgID = String(asset.id)
    const secondSVG = await withTempUpload(upload('icon-alternate.svg'), (file) =>
      payload.create({ collection: 'brand-assets', data: { alt: 'Alternate Icon' }, file }),
    )
    secondSVGID = String(secondSVG.id)
    const png = await (payload.db as MongooseAdapter).collections['brand-assets'].create({
      alt: 'PNG Icon',
      filename: 'icon.png',
      filesize: 68,
      mimeType: 'image/png',
    })
    pngID = String(png.id)
  }, 15_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
    if (uploadDirectory) await rm(uploadDirectory, { force: true, recursive: true })
  })

  it('enforces exact-value uniqueness while allowing case-distinct names', async () => {
    await payload.create({ collection: 'social-platforms', data: { icon: svgID, platform: 'GitHub' } })
    await expect(
      payload.create({ collection: 'social-platforms', data: { icon: svgID, platform: 'GitHub' } }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: 'A Social Platform named "GitHub" already exists.',
            path: 'platform',
          }),
        ],
      },
    })
    await expect(payload.create({ collection: 'social-platforms', data: { icon: svgID, platform: 'github' } })).resolves.toMatchObject({ platform: 'github' })
  })

  it('rejects missing, cleared, unresolved, and non-SVG icons and immutable-name updates', async () => {
    await expect(payload.create({ collection: 'social-platforms', data: { platform: 'Missing' } as never })).rejects.toThrow('The following field is invalid: Icon')
    await expect(payload.create({ collection: 'social-platforms', data: { icon: '000000000000000000000000', platform: 'Unknown' } })).rejects.toThrow('The following field is invalid: Icon')
    await expect(payload.create({ collection: 'social-platforms', data: { icon: pngID, platform: 'PNG' } })).rejects.toThrow('The following field is invalid: Icon')
    const platform = await payload.create({ collection: 'social-platforms', data: { icon: svgID, platform: 'Immutable' } })
    await expect(payload.update({ collection: 'social-platforms', id: platform.id, data: { platform: 'Changed' } })).rejects.toThrow('Platform cannot be changed after creation.')
    await expect(payload.update({ collection: 'social-platforms', id: platform.id, data: { icon: pngID } })).rejects.toThrow('The following field is invalid: Icon')
    await expect(payload.update({ collection: 'social-platforms', id: platform.id, data: { icon: null as never } })).rejects.toThrow('The following field is invalid: Icon')
    await expect(payload.update({ collection: 'social-platforms', id: platform.id, data: { icon: secondSVGID } })).resolves.toMatchObject({ platform: 'Immutable' })
    await expect(payload.findByID({ collection: 'brand-assets', id: svgID })).resolves.toMatchObject({ id: svgID })
  })

  it('rejects a repeated Platform relationship through the Local API', async () => {
    const platform = await payload.create({
      collection: 'social-platforms',
      data: { icon: svgID, platform: 'Local API Platform' },
    })

    await expect(payload.updateGlobal({
        slug: 'site-settings',
        data: {
          socialLinks: [
            { platform: platform.id, url: 'https://example.com/one' },
            { platform: platform.id, url: 'https://example.com/two' },
          ],
        },
      })).rejects.toMatchObject({
        data: {
          errors: [
            expect.objectContaining({
              message:
                'This Platform is already selected in Social Link row 1 and cannot be selected again in row 2.',
              path: 'socialLinks',
            }),
          ],
        },
      })
  })

  it('does not cascade-delete a Brand Asset with its Platform', async () => {
    const platform = await payload.create({
      collection: 'social-platforms',
      data: { icon: svgID, platform: 'Disposable Platform' },
    })
    await payload.delete({ collection: 'social-platforms', id: platform.id })
    await expect(payload.findByID({ collection: 'brand-assets', id: svgID })).resolves.toMatchObject({ id: svgID })
  })
})
