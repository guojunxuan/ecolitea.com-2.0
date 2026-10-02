// @vitest-environment node
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanupBlogs } from '../helpers/blogFixtures'

describe('Blog fixture cleanup reference safety', () => {
  let payload: Payload
  const runID = randomUUID().slice(0, 12)
  const databaseName = `task12-${runID}-e2e`
  const uri = `mongodb://127.0.0.1:27017/${databaseName}`
  const previousDatabaseURI = process.env.DATABASE_URI
  const previousDisableR2 = process.env.DISABLE_R2_STORAGE
  let pageID: string
  let mediaID: string

  beforeAll(async () => {
    process.env.DATABASE_URI = uri
    process.env.DISABLE_R2_STORAGE = 'true'
    console.info(`Blog fixture cleanup regression target: ${uri}; DISABLE_R2_STORAGE=true`)

    const config = await buildConfig({
      typescript: { autoGenerate: false },
      collections: [
        {
          slug: 'pages',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'mediaReference', type: 'text' },
          ],
          versions: { drafts: true },
        },
        {
          slug: 'case-studies',
          fields: [{ name: 'title', type: 'text' }],
          versions: { drafts: true },
        },
        {
          slug: 'posts',
          fields: [{ name: 'title', type: 'text' }],
          versions: { drafts: true },
        },
        {
          slug: 'blogs',
          fields: [
            { name: 'slug', type: 'text' },
            { name: 'relatedBlogs', type: 'relationship', relationTo: 'blogs', hasMany: true },
            { name: 'heroImage', type: 'relationship', relationTo: 'media' },
          ],
        },
        { slug: 'blog-categories', fields: [{ name: 'slug', type: 'text' }] },
        { slug: 'users', auth: true, fields: [{ name: 'email', type: 'text' }] },
        { slug: 'media', fields: [{ name: 'alt', type: 'text' }] },
        { slug: 'redirects', fields: [{ name: 'title', type: 'text' }] },
      ],
      globals: [
        { slug: 'header', fields: [{ name: 'title', type: 'text' }] },
        { slug: 'footer', fields: [{ name: 'title', type: 'text' }] },
      ],
      db: mongooseAdapter({ url: uri, connectOptions: { serverSelectionTimeoutMS: 3_000 } }),
      secret: 'isolated-blog-fixture-cleanup-test-secret',
    })
    payload = await getPayload({ config, key: databaseName })

    const fixturePrefix = `e2e-blogs-${runID}`
    mediaID = (
      await payload.create({
        collection: 'media',
        data: { alt: `${fixturePrefix} photograph` },
      })
    ).id
    const page = await payload.create({
      collection: 'pages',
      data: { title: 'Published page', mediaReference: mediaID } as never,
    })
    pageID = page.id
    await payload.update({
      collection: 'pages',
      id: pageID,
      draft: true,
      data: { title: 'New draft without media', mediaReference: null } as never,
    })
  }, 25_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
    if (previousDatabaseURI === undefined) Reflect.deleteProperty(process.env, 'DATABASE_URI')
    else process.env.DATABASE_URI = previousDatabaseURI
    if (previousDisableR2 === undefined) Reflect.deleteProperty(process.env, 'DISABLE_R2_STORAGE')
    else process.env.DISABLE_R2_STORAGE = previousDisableR2
  })

  it('refuses cleanup when a published page still references media removed from its latest draft', async () => {
    const published = await payload.findByID({
      collection: 'pages',
      id: pageID,
      draft: false,
      depth: 0,
    })
    const latestDraft = await payload.findByID({
      collection: 'pages',
      id: pageID,
      draft: true,
      depth: 0,
    })
    expect((published as unknown as { mediaReference: string | null }).mediaReference).toBe(mediaID)
    expect((latestDraft as unknown as { mediaReference: string | null }).mediaReference).toBeNull()

    await expect(cleanupBlogs(payload, runID)).rejects.toThrow(/referenced by pages\/.*published/i)
    await expect(payload.findByID({ collection: 'media', id: mediaID })).resolves.toMatchObject({
      alt: `e2e-blogs-${runID} photograph`,
    })
  })
})
