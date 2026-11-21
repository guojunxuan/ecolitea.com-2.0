// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { translations } from '@/plugins/translation/collections/translations'
import { translationSearch } from '@/plugins/translation/collections/translationSearch'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

describe('translation collections (isolated MongoDB)', () => {
  const name = `ecolitea2-test-phase4-collections-${randomUUID().slice(0, 8)}`
  const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test-phase4')
  let payload: Payload
  const identity = { sourceCollection: 'products', sourceId: 'source', locale: 'de' }

  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase2 collections target=${url}; storage=disabled; provider=none`)
    payload = await getPayload({
      key: name,
      config: buildConfig({
        secret: 'phase2-collections-test-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        collections: [translations, translationSearch],
      }),
    })
    await Promise.all(
      Object.values((payload.db as MongooseAdapter).collections).map((model) => model.init()),
    )
  }, 15000)
  afterAll(async () => {
    if (payload) {
      console.info(`Phase2 cleanup target=${url}; storage=disabled`)
      try {
        await (payload.db as MongooseAdapter).connection.dropDatabase()
      } finally {
        await payload.destroy()
      }
    }
  })

  it('allows privileged Local API writes and enforces compound translation uniqueness', async () => {
    const doc = await payload.create({
      collection: 'translations',
      data: { ...identity, status: 'pending' },
      overrideAccess: true,
    })
    expect(doc).toMatchObject(identity)
    await expect(
      payload.create({
        collection: 'translations',
        data: { ...identity, status: 'pending' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'translations',
        data: { ...identity, locale: 'fr', status: 'pending' },
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ locale: 'fr' })
  })

  it('enforces independent translated search identity', async () => {
    const data = {
      ...identity,
      sourceVersion: 'v1',
      title: 'Titel',
      path: '/products/tea/source',
      ready: true,
    }
    await payload.create({ collection: 'translation-search', data, overrideAccess: true })
    await expect(
      payload.create({ collection: 'translation-search', data, overrideAccess: true }),
    ).rejects.toThrow()
    await expect(
      payload.create({
        collection: 'translation-search',
        data: { ...data, locale: 'fr' },
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ locale: 'fr' })
  })

  it('denies anonymous reads and all non-privileged writes', async () => {
    await expect(
      payload.find({ collection: 'translations', overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    const result = await payload.find({ collection: 'translations', overrideAccess: true })
    const id = result.docs[0].id
    await expect(
      payload.create({
        collection: 'translations',
        overrideAccess: false,
        data: { ...identity, locale: 'es', status: 'pending' },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.update({
        collection: 'translations',
        id,
        overrideAccess: false,
        data: { status: 'ready' },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({ collection: 'translations', id, overrideAccess: false }),
    ).rejects.toMatchObject({ status: 403 })
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      expect(
        await translationSearch.access![operation]!({
          req: { payload, user: { id: 'staff' } },
        } as never),
      ).toBe(false)
    }
  })

  it('reuses authenticated staff access and makes status fields read-only', async () => {
    expect(
      await translations.access!.read!({ req: { payload, user: { id: 'staff' } } } as never),
    ).toBe(true)
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(
        await translations.access![operation]!({
          req: { payload, user: { id: 'staff' } },
        } as never),
      ).toBe(false)
    }
    // Payload adds the timestamps and (Payload 4) the authorship fields when it sanitizes the config.
    const declaredFields = translations.fields.filter(
      (field) =>
        'name' in field &&
        !['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(field.name),
    )
    expect(
      declaredFields.every(
        (field) => field.admin && 'readOnly' in field.admin && field.admin.readOnly,
      ),
    ).toBe(true)
    expect(translations.admin?.group).toBe('System')
  })
})
