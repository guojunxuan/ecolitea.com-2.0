import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'
import { imageOnly, imageOrVideo } from '@/collections/mediaUploadPolicy'
import { CallToAction } from '@/blocks/CallToAction/config'
import { MediaBlock } from '@/blocks/MediaBlock/config'
import { hero } from '@/heros/config'
import { Blogs } from '@/collections/Blogs'
import { Posts } from '@/collections/Posts'
import { Pages } from '@/collections/Pages'
import { CaseStudies } from '@/collections/CaseStudies'
import { imageField } from '@/Header/blocks/fields'
import { blogTab } from '@/Settings/fields/blog'

const find = (fields: Field[], path: string): Field | undefined => {
  const [name, ...rest] = path.split('.')
  for (const field of fields) {
    if ('name' in field && field.name === name)
      return rest.length && 'fields' in field ? find(field.fields, rest.join('.')) : field
    if ('tabs' in field) {
      for (const tab of field.tabs) {
        const found =
          'name' in tab && tab.name === name
            ? find(tab.fields, rest.join('.'))
            : !('name' in tab)
              ? find(tab.fields, path)
              : undefined
        if (found) return found
      }
    }
    if ('fields' in field && !('name' in field)) {
      const found = find(field.fields, path)
      if (found) return found
    }
  }
}
describe('Media reference filters', () => {
  it.each([
    ['CTA', CallToAction.fields, 'media', imageOnly],
    ['MediaBlock', MediaBlock.fields, 'media', imageOrVideo],
    ['Hero', 'fields' in hero ? hero.fields : [], 'media', imageOrVideo],
    ['Blogs hero', Blogs.fields, 'heroImage', imageOnly],
    ['Posts hero', Posts.fields, 'heroImage', imageOnly],
    ...[Blogs, Posts, Pages, CaseStudies].map((collection) => [
      collection.slug,
      collection.fields,
      'meta.image',
      imageOnly,
    ]),
    ['Settings hero', blogTab.fields, 'hero.image', imageOnly],
    ['Settings SEO', blogTab.fields, 'seo.image', imageOnly],
  ] as [string, Field[], string, unknown][])(
    '%s uses the shared MIME allowlist',
    (_name, fields, path, expected) => {
      expect(find(fields, path)).toMatchObject({ filterOptions: expected })
    },
  )
  it('filters header cards to images', () =>
    expect(imageField()).toMatchObject({ filterOptions: imageOnly }))
})

// Validate the actual upload field configs through Payload's Local API. Payload
// enforces filterOptions server-side as well as in the relationship picker.
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import { beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { validateMediaAlt } from '@/collections/mediaAlt'
import { Media } from '@/collections/Media'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const consumers = [
  find(CallToAction.fields, 'media'),
  find(MediaBlock.fields, 'media'),
  find('fields' in hero ? hero.fields : [], 'media'),
  find(Blogs.fields, 'heroImage'),
  find(Posts.fields, 'heroImage'),
  ...[Blogs, Posts, Pages, CaseStudies].map((c) => find(c.fields, 'meta.image')),
  imageField(),
  find(blogTab.fields, 'hero.image'),
  find(blogTab.fields, 'seo.image'),
]
describe('Media reference constraints through Local API', () => {
  let payload: Payload
  let videoID: string
  let pdfID: string
  beforeAll(async () => {
    const databaseName = `ecolitea2-media-filters-${randomUUID()}`
    const url = createIsolatedTestDatabaseURI(databaseName)
    console.info(`Media filters target: ${url}; no storage plugins, upload storage disabled`)
    payload = await getPayload({
      key: databaseName,
      config: buildConfig({
        secret: 'isolated-media-filters-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        email: () => ({
          name: 'test',
          defaultFromAddress: 'test@example.invalid',
          defaultFromName: 'Test',
          sendEmail: async () => undefined,
        }),
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        collections: [
          {
            slug: 'media',
            upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
            hooks: {
              beforeValidate: [validateMediaAlt],
              beforeChange: [
                ({ data, context }) =>
                  context.legacyFixture ? { ...data, alt: 'IMG_1234' } : data,
              ],
            },
            fields: Media.fields.filter(
              (field) => 'name' in field && ['alt', 'width', 'filesize'].includes(field.name),
            ),
          },
          {
            slug: 'pages',
            fields: consumers.map((field, index) => {
              if (!field || field.type !== 'upload') throw new Error(`Missing consumer ${index}`)
              return { ...field, name: `consumer${index}`, required: false, admin: {} }
            }),
          },
        ],
      }),
    })
    videoID = String(
      (
        await payload.create({
          collection: 'media',
          data: { mimeType: 'video/mp4', alt: 'Test video' } as never,
        })
      ).id,
    )
    pdfID = String(
      (
        await payload.create({
          collection: 'media',
          data: { mimeType: 'application/pdf', alt: 'Legacy document' } as never,
        })
      ).id,
    )
  }, 15000)
  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })
  it('merges native upload field overrides without duplicate fields', () => {
    const fields = payload.collections.media.config.fields
    for (const name of ['width', 'filesize']) {
      const matches = fields.filter((field) => 'name' in field && field.name === name)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({
        admin: { hidden: true, readOnly: true, components: { Cell: expect.any(String) } },
      })
    }
  })
  it('enforces alt on create and allows untouched legacy alt on update', async () => {
    await expect(payload.create({ collection: 'media', data: { alt: '' } })).rejects.toMatchObject({
      status: 400,
      data: { errors: [{ path: 'alt', message: 'Alt text is required.' }] },
    })
    const legacy = await payload.create({
      collection: 'media',
      context: { legacyFixture: true },
      data: { alt: 'Valid initial description' },
    })
    await expect(
      payload.update({ collection: 'media', id: legacy.id, data: { alt: 'IMG_1234' } }),
    ).resolves.toHaveProperty('alt', 'IMG_1234')
    await expect(
      payload.update({ collection: 'media', id: legacy.id, data: { alt: 'photo' } }),
    ).rejects.toMatchObject({ status: 400 })
  })
  it.each(consumers.map((_, index) => [index]))(
    'rejects PDFs through consumer %s',
    async (index) => {
      await expect(
        payload.create({ collection: 'pages', data: { [`consumer${index}`]: pdfID } as never }),
      ).rejects.toMatchObject({ status: 400 })
    },
  )
  it.each(consumers.map((_, index) => [index]).filter(([index]) => index !== 1 && index !== 2))(
    'rejects video in image-only consumer %s',
    async (index) => {
      await expect(
        payload.create({ collection: 'pages', data: { [`consumer${index}`]: videoID } as never }),
      ).rejects.toMatchObject({ status: 400 })
    },
  )
  it.each([1, 2])('accepts video in consumer %s', async (index) => {
    await expect(
      payload.create({ collection: 'pages', data: { [`consumer${index}`]: videoID } as never }),
    ).resolves.toHaveProperty(`consumer${index}`)
  })
})

describe('Media upload errors through the real Local API pipeline', () => {
  let payload: Payload
  let mediaID: string
  beforeAll(async () => {
    const databaseName = `ecolitea2-media-uploads-${randomUUID()}`
    const url = createIsolatedTestDatabaseURI(databaseName)
    console.info(
      `Media upload error target: ${url}; no storage plugins, local upload storage disabled`,
    )
    if (!Media.upload || typeof Media.upload !== 'object') throw new Error('Media upload missing')
    payload = await getPayload({
      key: databaseName,
      config: buildConfig({
        secret: 'isolated-media-uploads-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        email: () => ({
          name: 'test',
          defaultFromAddress: 'test@example.invalid',
          defaultFromName: 'Test',
          sendEmail: async () => undefined,
        }),
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        collections: [
          {
            ...Media,
            upload: { ...Media.upload, disableLocalStorage: true, filesRequiredOnCreate: false },
            fields: Media.fields.filter(
              (field) =>
                'name' in field &&
                ['alt', 'width', 'filesize', 'durationSeconds'].includes(field.name),
            ),
          },
        ],
      }),
    })
    mediaID = String(
      (await payload.create({ collection: 'media', data: { alt: 'Existing source image' } })).id,
    )
  }, 15000)
  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })
  it.each(
    [
      ['application/pdf', 'document.pdf', '%PDF-1.7\n1 0 obj\n<<>>\nendobj'],
      [
        'image/svg+xml',
        'icon.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
      ],
      ['application/octet-stream', 'payload.bin', 'unsupported binary data'],
    ].flatMap((file) => ['create', 'update'].map((operation) => [operation, ...file])),
  )(
    'returns the D4 message on %s for actual %s uploads',
    async (operation, mimetype, name, bytes) => {
      const file = { mimetype, name, data: Buffer.from(bytes), size: Buffer.byteLength(bytes) }
      const message = `Unsupported file type: ${mimetype}. Media accepts images (JPEG, PNG, WebP, AVIF, GIF) and video (MP4).`
      const result =
        operation === 'create'
          ? payload.create({ collection: 'media', data: { alt: 'Rejected source file' }, file })
          : payload.update({
              collection: 'media',
              id: mediaID,
              data: { alt: 'Rejected replacement file' },
              file,
            })
      await expect(result).rejects.toThrow(message)
    },
  )
})
