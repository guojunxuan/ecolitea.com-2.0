import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildConfig, getPayload, type Payload } from 'payload'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { Media } from '@/collections/Media'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

describe('native Media folders', () => {
  let payload: Payload
  beforeAll(async () => {
    const name = `ecolitea2-media-folders-${randomUUID()}`
    const url = createIsolatedTestDatabaseURI(name)
    console.info(
      `Media folders target: ${url}; DISABLE_R2_STORAGE=true; no storage plugins, local storage disabled`,
    )
    payload = await getPayload({
      key: name,
      config: buildConfig({
        secret: 'isolated-media-folders-secret-at-least-32-characters',
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
            slug: 'folders',
            folders: true,
            fields: [{ name: 'name', type: 'text', required: true }],
          },
          {
            ...Media,
            fields: Media.fields.filter(
              (field) => 'name' in field && ['alt', '_h_folders'].includes(field.name),
            ),
            upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
            hooks: {
              ...Media.hooks,
              beforeChange: [
                ({ data, context }) =>
                  context.legacyFixture ? { ...data, alt: 'IMG_1234' } : data,
              ],
            },
          },
        ],
      }),
    })
  }, 15000)
  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })
  it('archives media and deletes descendant folders without deleting media or validating unchanged legacy alt', async () => {
    const parent = await payload.create({ collection: 'folders', data: { name: 'Parent' } })
    const child = await payload.create({
      collection: 'folders',
      data: { name: 'Child', _h_folders: parent.id },
    })
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Tea garden archive', _h_folders: child.id },
      context: { legacyFixture: true },
      depth: 0,
    })
    expect(media.alt).toBe('IMG_1234')
    expect(media._h_folders).toBe(child.id)
    await payload.delete({ collection: 'folders', id: parent.id })
    expect((await payload.find({ collection: 'folders' })).docs).toHaveLength(0)
    const remaining = await payload.findByID({ collection: 'media', id: media.id, depth: 0 })
    expect(remaining._h_folders ?? null).toBeNull()
    expect(remaining.alt).toBe('IMG_1234')
  })
})
