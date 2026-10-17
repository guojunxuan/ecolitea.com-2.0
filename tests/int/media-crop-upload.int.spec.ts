// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Media } from '@/collections/Media'

let payload: Payload
let uploadDirectory: string
const databaseURL = createIsolatedTestDatabaseURI(
  `ecolitea2-test-task4-crop-${randomUUID()}`,
  'mongodb://127.0.0.1:27017/ecolitea2-test',
)
let original: Buffer
let id: string | undefined

beforeAll(async () => {
  if (process.env.DISABLE_R2_STORAGE !== 'true')
    throw new Error('Crop integration requires R2 disabled')
  console.info(
    `Task4 integration target: database=${databaseURL}; storage=temporary local directory; R2 disabled`,
  )
  uploadDirectory = await mkdtemp(path.join(tmpdir(), 'ecolitea-task4-crop-'))
  const upload = typeof Media.upload === 'object' ? Media.upload : {}
  // Exercise the real Media hooks and Payload file pipeline with no unrelated
  // relationship/references fixtures or application plugins.
  const config = await buildConfig({
    secret: 'task4-isolated-local-payload-secret-long-enough',
    typescript: { autoGenerate: false },
    db: mongooseAdapter({ url: databaseURL, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    sharp,
    collections: [
      {
        ...Media,
        fields: Media.fields.filter(
          (field) => 'name' in field && ['alt', 'durationSeconds'].includes(field.name),
        ),
        hooks: { ...Media.hooks, beforeDelete: [] },
        upload: { ...upload, staticDir: uploadDirectory },
      },
    ],
  })
  payload = await getPayload({ config, key: 'task4-crop' })
  original = await sharp({
    create: { width: 1100, height: 1000, channels: 3, background: 'green' },
  })
    .jpeg()
    .toBuffer()
}, 30_000)

afterAll(async () => {
  if (id) await payload.delete({ collection: 'media', id })
  if (payload) {
    console.info(
      `Task4 cleanup target: ${databaseURL}; ephemeral local upload directory ${uploadDirectory}; R2 disabled`,
    )
    await (payload.db as MongooseAdapter).connection.dropDatabase()
    await payload.destroy()
  }
  if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true })
})

describe('Payload crop before Media validation', () => {
  it('rejects an unfit original directly and writes no file', async () => {
    const before = await readdir(uploadDirectory)
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'Green tea garden' },
        file: {
          data: original,
          mimetype: 'image/jpeg',
          name: 'unfit-original.jpg',
          size: original.length,
        },
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(await readdir(uploadDirectory)).toEqual(before)
  })
  it('persists the cropped original and validates its actual sharp dimensions', async () => {
    const doc = await payload.create({
      collection: 'media',
      data: { alt: 'Green tea garden' },
      file: {
        data: original,
        mimetype: 'image/jpeg',
        name: 'cropped-original.jpg',
        size: original.length,
      },
      req: {
        query: {
          uploadEdits: {
            crop: { unit: '%', x: 5, y: 0, width: 90.9090909, height: 100 },
            widthInPixels: 1000,
            heightInPixels: 1000,
            focalPoint: { x: 0, y: 100 },
          },
        },
      },
    })
    id = doc.id
    expect([doc.width, doc.height]).toEqual([1000, 1000])
    expect([doc.focalX, doc.focalY]).toEqual([0, 100])
    const saved = await sharp(path.join(uploadDirectory, doc.filename!)).metadata()
    expect([saved.width, saved.height]).toEqual([1000, 1000])
  })
})
