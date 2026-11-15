// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload, type SlugField } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pages } from '@/collections/Pages'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const name = `ecolitea2-test-phase3-slug-writes-${randomUUID().slice(0, 8)}`
const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test')
const slug = Pages.fields.find((field) => 'name' in field && field.name === 'slug') as SlugField

describe('Page reserved slug write boundary (isolated MongoDB)', () => {
  let payload: Payload
  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase3 slug writes target=${url}; storage=disabled; provider=none`)
    payload = await getPayload({
      key: name,
      config: buildConfig({
        secret: 'phase3-slug-writes-test-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        collections: [
          {
            slug: 'pages',
            fields: [{ name: 'title', type: 'text' }, slug],
            versions: { drafts: true },
          },
        ],
      }),
    })
  }, 15000)
  afterAll(async () => {
    if (payload) {
      console.info(`Phase3 cleanup target=${url}; storage=disabled`)
      try {
        await (payload.db as MongooseAdapter).connection.dropDatabase()
      } finally {
        await payload.destroy()
      }
    }
  })

  it.each([false, true])('rejects explicit reserved slugs even with draft=%s', async (draft) => {
    await expect(
      payload.create({
        collection: 'pages',
        draft,
        data: { title: 'German', slug: 'de' } as never,
      }),
    ).rejects.toMatchObject({
      data: { errors: [{ path: 'slug', message: expect.stringMatching(/reserved.*language/i) }] },
    })
  })

  it('rejects a reserved slug generated from the title in a draft', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        draft: true,
        data: { title: 'DE' } as never,
      }),
    ).rejects.toMatchObject({ data: { errors: [{ path: 'slug' }] } })
  })

  it('rejects a normalized reserved slug on draft update and preserves saved content', async () => {
    const doc = await payload.create({
      collection: 'pages',
      data: { title: 'Safe', slug: 'safe' } as never,
    })
    await expect(
      payload.update({
        collection: 'pages',
        id: doc.id,
        draft: true,
        data: { slug: '  ZH-TW  ' },
      }),
    ).rejects.toMatchObject({ data: { errors: [{ path: 'slug' }] } })
    expect(await payload.findByID({ collection: 'pages', id: doc.id, draft: true })).toMatchObject({
      slug: 'safe',
    })
  })

  it.each(['dev', 'd'])('allows %s through the actual write pipeline', async (slug) => {
    expect(
      await payload.create({ collection: 'pages', data: { title: slug, slug } as never }),
    ).toMatchObject({ slug })
  })
})
