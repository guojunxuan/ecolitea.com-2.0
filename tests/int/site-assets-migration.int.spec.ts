import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { up, down } from '@/migrations/20261013_site_assets'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

describe('Site Assets database migration', () => {
  let payload: Payload
  let adapter: MongooseAdapter
  const databaseName = `ecolitea2-assets-${randomUUID()}`
  const databaseURI = createIsolatedTestDatabaseURI(databaseName)
  const asset = { _id: 'asset-id', filename: 'logo.svg', url: 'https://media.example.invalid/logo.svg' }

  beforeAll(async () => {
    console.info(`Migration test target: ${databaseURI}; storage: disabled, no uploads`)
    payload = await getPayload({ key: databaseName, config: buildConfig({
      collections: [],
      db: mongooseAdapter({ url: databaseURI, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
      secret: 'isolated-site-assets-migration-test-secret',
    }) })
    adapter = payload.db as MongooseAdapter
  }, 15000)

  afterAll(async () => {
    if (payload) {
      console.info(`Migration test cleanup: ${databaseURI}; storage: disabled`)
      await adapter.connection.dropDatabase()
      await payload.destroy()
    }
  })

  beforeEach(async () => {
    const db = adapter.connection.db!
    await adapter.connection.dropDatabase()
    await db.collection<{ _id: string; [key: string]: unknown }>('brand-assets').insertOne(asset)
    await db.collection<{ _id: string; [key: string]: unknown }>('_brand-assets_versions').insertOne({ _id: 'legacy', value: asset })
    await db.collection<{ _id: string; [key: string]: unknown }>('payload-locked-documents').insertMany([
      { _id: 'lock', document: { relationTo: 'brand-assets', value: asset._id } },
      { _id: 'other', document: { relationTo: 'media', value: 'media-id' } },
    ])
    await db.collection<{ _id: string; [key: string]: unknown }>('payload-preferences').insertMany([
      { _id: 'pref', key: 'collection-brand-assets-brand-assets', value: { sort: 'filename' } },
      { _id: 'other', key: 'collection-media', value: {} },
    ])
  })

  it('renames assets, lock references and all preference substrings reversibly, preserving versions and IDs', async () => {
    const db = adapter.connection.db!
    const info = vi.spyOn(payload.logger, 'info')
    await up({ payload, req: { payload } as never })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('site-assets').findOne({ _id: asset._id })).toEqual(asset)
    expect(await db.listCollections({ name: 'brand-assets' }).toArray()).toHaveLength(0)
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-locked-documents').findOne({ _id: 'lock' })).toMatchObject({ document: { relationTo: 'site-assets', value: 'asset-id' } })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-preferences').findOne({ _id: 'pref' })).toMatchObject({ key: 'collection-site-assets-site-assets' })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('_brand-assets_versions').findOne({ _id: 'legacy' })).toEqual({ _id: 'legacy', value: asset })
    expect(info).toHaveBeenCalledWith(expect.objectContaining({ msg: expect.stringContaining('_brand-assets_versions: 1') }))
    await down({ payload, req: { payload } as never })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('brand-assets').findOne({ _id: asset._id })).toEqual(asset)
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-locked-documents').findOne({ _id: 'lock' })).toMatchObject({ document: { relationTo: 'brand-assets' } })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-preferences').findOne({ _id: 'pref' })).toMatchObject({ key: 'collection-brand-assets-brand-assets' })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-locked-documents').findOne({ _id: 'other' })).toMatchObject({ document: { relationTo: 'media' } })
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-preferences').findOne({ _id: 'other' })).toMatchObject({ key: 'collection-media' })
    info.mockRestore()
  })

  it('runs the actual Payload migration CLI up and down without creating a collision during initialization', async () => {
    const db = adapter.connection.db!
    const run = (command: string) => promisify(execFile)('corepack', ['pnpm', 'payload', command], {
      cwd: process.cwd(),
      timeout: 30000,
      env: {
        ...process.env,
        DATABASE_URI: databaseURI,
        DISABLE_R2_STORAGE: 'true',
        PAYLOAD_CONFIG_PATH: 'tests/int/fixtures/site-assets-payload.config.ts',
        NODE_ENV: 'test',
      },
    })
    console.info(`Payload CLI migration test target: ${databaseURI}; storage: disabled`)
    const result = await run('migrate')
    expect(result.stdout).toContain('Migrated:')
    expect(await db.listCollections({ name: 'brand-assets' }).toArray()).toHaveLength(0)
    expect(await db.collection('site-assets').countDocuments()).toBe(1)
    expect(await db.collection('payload-migrations').countDocuments({ name: '20261013_site_assets' })).toBe(1)
    await run('migrate:down')
    expect(await db.listCollections({ name: 'site-assets' }).toArray()).toHaveLength(0)
    expect(await db.collection('brand-assets').countDocuments()).toBe(1)
    expect(await db.collection('payload-migrations').countDocuments({ name: '20261013_site_assets' })).toBe(0)
  }, 60000)

  it('aborts before writes when either direction has an existing destination, including an empty collection', async () => {
    const db = adapter.connection.db!
    await db.createCollection('site-assets')
    await expect(up({ payload, req: { payload } as never })).rejects.toThrow('Destination collection site-assets already exists')
    await expect(down({ payload, req: { payload } as never })).rejects.toThrow('Destination collection brand-assets already exists')
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('brand-assets').countDocuments()).toBe(1)
    expect(await db.collection<{ _id: string; [key: string]: unknown }>('payload-preferences').findOne({ _id: 'pref' })).toMatchObject({ key: 'collection-brand-assets-brand-assets' })
  })
})
