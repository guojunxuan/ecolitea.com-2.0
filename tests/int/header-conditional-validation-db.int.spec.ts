import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type CollectionConfig, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Header } from '@/Header/config'
import { normalizeHeader } from '@/Header/hooks/normalizeHeader'

const relatedCollection = (
  slug: 'pages' | 'posts' | 'case-studies' | 'categories',
): CollectionConfig => ({
  slug,
  fields: [{ name: 'title', type: 'text' }],
})

describe('Header conditional validation through the Payload Local API', () => {
  let databaseName: string
  let mediaID: string
  let payload: Payload

  beforeAll(async () => {
    databaseName = `ecolitea2-header-blocks-${randomUUID()}`
    const config = await buildConfig({
      collections: [
        ...(['pages', 'posts', 'case-studies', 'categories'] as const).map(relatedCollection),
        {
          slug: 'media',
          fields: [{ name: 'mimeType', type: 'text' }],
        },
      ],
      db: mongooseAdapter({
        connectOptions: { serverSelectionTimeoutMS: 3_000 },
        url: `mongodb://127.0.0.1:27017/${databaseName}`,
      }),
      globals: [
        {
          ...Header,
          hooks: { beforeValidate: [normalizeHeader] },
        },
      ],
      secret: 'header-block-validation-test-secret-at-least-32-characters',
    })
    payload = await getPayload({ config, key: databaseName })
    const media = await payload.create({ collection: 'media', data: { mimeType: 'image/png' } })
    mediaID = String(media.id)
  }, 15_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })

  const headerData = (enableCta: boolean) => ({
    navItems: [
      {
        label: 'Products',
        navigationType: 'dropdown' as const,
        content: [
          {
            blockType: 'cardGroup' as const,
            enableHeading: false,
            heading: '',
            enableCta,
            cta: { type: 'custom' as const, label: '', url: '' },
            items: [
              {
                image: mediaID,
                title: 'Green tea',
                link: { type: 'custom' as const, url: '/tea/green' },
              },
            ],
          },
        ],
      },
    ],
  })

  it('preserves incomplete inactive heading and CTA data without validation errors', async () => {
    await expect(
      payload.updateGlobal({ slug: 'header', data: headerData(false) as never }),
    ).resolves.toMatchObject({
      navItems: [
        {
          content: [
            expect.objectContaining({
              enableHeading: false,
              heading: '',
              enableCta: false,
              cta: expect.objectContaining({ label: '', url: '' }),
            }),
          ],
        },
      ],
    })
  })

  it('rejects the same incomplete CTA when it is enabled', async () => {
    await expect(
      payload.updateGlobal({ slug: 'header', data: headerData(true) as never }),
    ).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: expect.stringContaining('cta') }),
        ]),
      },
    })
  })
})
