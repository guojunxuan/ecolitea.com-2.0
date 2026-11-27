import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { describe, expect, it } from 'vitest'
import {
  planResourcesRename,
  scanResourcesRename,
} from '@/migrations/20261110_product_resources_rename'

describe('product resources rename plan', () => {
  it.each([
    ['up', false, { content: ['doc'] }, { content: 'resources' }],
    ['up', true, { version: { content: null } }, { 'version.content': 'version.resources' }],
    ['down', false, { resources: [] }, { resources: 'content' }],
    ['down', true, { version: { resources: ['doc'] } }, { 'version.resources': 'version.content' }],
  ] as const)('renames %s (version=%s)', (direction, version, document, rename) => {
    expect(planResourcesRename(document, version, direction)).toEqual({ rename })
  })

  it('is a no-op when the source field is absent, so reruns are safe', () => {
    expect(planResourcesRename({ resources: ['doc'] }, false, 'up')).toEqual({})
    expect(planResourcesRename({ version: {} }, true, 'up')).toEqual({})
  })

  it('blocks records that already hold both fields or an unexpected value', () => {
    expect(planResourcesRename({ content: [], resources: [] }, false, 'up').issue).toMatch(
      /Both content and resources/,
    )
    expect(planResourcesRename({ content: 'doc' }, false, 'up').issue).toMatch(/array or null/)
    expect(planResourcesRename({ version: null }, true, 'up').issue).toMatch(/version object/)
  })
})

const fakeAdapter = (
  products: Record<string, unknown>[],
  versions: Record<string, unknown>[],
  databaseName = 'ecolitea2-test',
) => {
  const collection = (collectionName: string, docs: Record<string, unknown>[]) => ({
    collectionName,
    async *find() {
      yield* docs
    },
    bulkWrite: async () => ({ matchedCount: 0 }),
  })
  return {
    connection: { host: '127.0.0.1', port: 27017, db: { databaseName } },
    collections: { products: { collection: collection('products', products) } },
    versions: { products: { collection: collection('_products_versions', versions) } },
  } as unknown as MongooseAdapter
}

describe('product resources rename scan', () => {
  it('reports renames with compare-and-set filters for products and versions', async () => {
    const report = await scanResourcesRename(
      fakeAdapter([{ _id: 'p1', content: ['d1'] }], [{ _id: 'v1', version: { content: ['d1'] } }]),
      'up',
    )
    expect(report.allowedToWrite).toBe(true)
    expect(report.toRename).toBe(2)
    expect(report.writes[1].operations[0].updateOne).toEqual({
      filter: {
        _id: 'v1',
        'version.resources': { $exists: false },
        $expr: { $eq: ['$version.content', { $literal: ['d1'] }] },
      },
      update: { $rename: { 'version.content': 'version.resources' } },
      collation: { locale: 'simple' },
    })
  })

  it('refuses to write when any record is blocked', async () => {
    const report = await scanResourcesRename(
      fakeAdapter([{ _id: 'p1', content: [], resources: [] }], []),
      'up',
    )
    expect(report.allowedToWrite).toBe(false)
    expect(report.collections[0].issues).toEqual([
      { id: 'p1', path: 'content', reason: 'Both content and resources are present' },
    ])
  })

  it('scans any connected database', async () => {
    const report = await scanResourcesRename(fakeAdapter([], [], 'production'), 'up')
    expect(report.allowedToWrite).toBe(true)
  })
})
