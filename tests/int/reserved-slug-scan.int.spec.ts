// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  describeDatabaseTarget,
  parseScanArguments,
  scanReservedSlugs,
} from '../../scripts/scan-reserved-slugs'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const name = `ecolitea2-test-phase3-slug-scan-${randomUUID().slice(0, 8)}`
const url = createIsolatedTestDatabaseURI(name, 'mongodb://127.0.0.1:27017/ecolitea2-test')

describe('reserved slug scan safety', () => {
  it('requires explicit confirmation for every database', () => {
    expect(() => parseScanArguments([], name)).toThrow(/--confirm/)
    expect(parseScanArguments(['--confirm'], name)).toEqual({ confirm: true })
    expect(() => parseScanArguments(['--confirm', '--execute'], name)).toThrow(/unknown/i)
  })

  it('requires an exact second confirmation for non-test databases', () => {
    expect(() => parseScanArguments(['--confirm'], 'example-content')).toThrow(/non-test/i)
    expect(() =>
      parseScanArguments(['--confirm', '--confirm-non-test=wrong'], 'example-content'),
    ).toThrow(/non-test/i)
    expect(
      parseScanArguments(['--confirm', '--confirm-non-test=example-content'], 'example-content'),
    ).toEqual({ confirm: true })
  })

  it('always refuses the developer database', () => {
    expect(() =>
      parseScanArguments(['--confirm', '--confirm-non-test=ecolitea2'], 'ecolitea2'),
    ).toThrow(/developer database/)
  })

  it('reports the exact host and database without exposing credentials', () => {
    expect(describeDatabaseTarget('mongodb://user:secret@127.0.0.1:27017/example-test')).toEqual({
      database: 'example-test',
      label: '127.0.0.1:27017/example-test',
    })
    expect(() => describeDatabaseTarget('https://example.invalid/test')).toThrow(/mongodb/i)
    expect(() => describeDatabaseTarget('mongodb://127.0.0.1:27017/')).toThrow(/database/i)
  })
})

describe('reserved slug scan (isolated MongoDB)', () => {
  let payload: Payload
  beforeAll(async () => {
    if (process.env.DISABLE_R2_STORAGE !== 'true') throw new Error('Set DISABLE_R2_STORAGE=true')
    console.info(`Phase3 slug scan target=${url}; storage=disabled; provider=none`)
    payload = await getPayload({
      key: name,
      config: buildConfig({
        secret: 'phase3-slug-scan-test-secret-at-least-32-characters',
        typescript: { autoGenerate: false },
        db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
        // Model existing content before the reserved-slug validator was introduced.
        collections: [
          {
            slug: 'pages',
            fields: [{ name: 'slug', type: 'text' }],
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

  it('reports conflicting published and draft slugs without changing documents', async () => {
    const german = await payload.create({
      collection: 'pages',
      data: { slug: 'de', _status: 'published' } as never,
      overrideAccess: true,
    })
    const chinese = await payload.create({
      collection: 'pages',
      draft: true,
      data: { slug: 'zh-tw' } as never,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'pages',
      data: { slug: 'dev', _status: 'published' } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'pages',
      id: german.id,
      draft: true,
      data: { slug: 'german' },
      overrideAccess: true,
    })
    const before = await payload.find({
      collection: 'pages',
      draft: true,
      depth: 0,
      sort: 'id',
      overrideAccess: true,
    })
    const report = await scanReservedSlugs(payload)
    expect(report).toEqual(
      expect.arrayContaining([
        { collection: 'pages', id: String(german.id), slug: 'de', status: 'published' },
        { collection: 'pages', id: String(chinese.id), slug: 'zh-tw', status: 'draft' },
      ]),
    )
    expect(report).toHaveLength(2)
    const output = await promisify(execFile)(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/scan-reserved-slugs.ts', '--confirm'],
      {
        env: {
          ...process.env,
          DATABASE_URI: url,
          DISABLE_R2_STORAGE: 'true',
          JOBS_AUTORUN: 'false',
          NODE_ENV: 'test',
        },
        timeout: 20000,
      },
    )
    expect(output.stderr).toContain(
      `database=127.0.0.1:27017/${name}; storage=disabled; mode=read-only`,
    )
    expect(output.stdout).toContain(JSON.stringify(report, null, 2))
    expect(
      await payload.find({
        collection: 'pages',
        draft: true,
        depth: 0,
        sort: 'id',
        overrideAccess: true,
      }),
    ).toEqual(before)
  }, 30000)
})
