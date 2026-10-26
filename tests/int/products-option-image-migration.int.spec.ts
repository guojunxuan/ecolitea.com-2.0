import { isDeepStrictEqual } from 'node:util'
import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import {
  down,
  up,
  planProductOptionImageMigration as plan,
  scanProductOptionImageMigration as scan,
} from '@/migrations/20261026_products_option_image_flat_specs'
type Document = Record<string, unknown>
type Operation = {
  updateOne: { filter: Document; update: { $set?: Document; $unset?: Document } }
}
function fixture(main: Document[] = [], versions: Document[] = []) {
  let beforeWrite: (() => void) | undefined
  const fieldValue = (document: Document, path: string) => {
    const parts = path.split('.')
    const field = parts.pop()!
    const base = parts.reduce((base, key) => base?.[key] as Document, document)
    return { exists: Boolean(base && Object.hasOwn(base, field)), value: base?.[field] }
  }
  const matches = (document: Document, filter: Document): boolean =>
    Object.entries(filter).every(([key, condition]) => {
      if (key === '$and') return (condition as Document[]).every((part) => matches(document, part))
      if (key === '$expr') {
        const [path, expected] = (condition as { $eq: [string, { $literal: unknown }] }).$eq
        return isDeepStrictEqual(fieldValue(document, path.slice(1)).value, expected.$literal)
      }
      if (condition && typeof condition === 'object' && '$exists' in condition)
        return fieldValue(document, key).exists === condition.$exists
      return isDeepStrictEqual(fieldValue(document, key).value, condition)
    })
  const documents = { products: main, _products_versions: versions }
  const handles = Object.fromEntries(
    Object.entries(documents).map(([collectionName, docs]) => [
      collectionName,
      {
        collectionName,
        find: vi.fn((_filter: Document, _options?: unknown) => ({
          async *[Symbol.asyncIterator]() {
            yield* docs
          },
        })),
        bulkWrite: vi.fn(async (operations: Operation[], _options?: unknown) => {
          beforeWrite?.()
          let matchedCount = 0
          for (const { updateOne } of operations) {
            const document = docs.find((doc) => matches(doc, updateOne.filter))
            if (!document) continue
            matchedCount++
            for (const [operator, values] of Object.entries(updateOne.update)) {
              for (const [path, value] of Object.entries(values as Document)) {
                const parts = path.split('.')
                const field = parts.pop()!
                const base = parts.reduce((base, key) => base[key] as Document, document)
                if (operator === '$set') base[field] = value
                else delete base[field]
              }
            }
          }
          return { matchedCount }
        }),
      },
    ]),
  )
  const payload = {
    db: {
      collections: { products: { collection: handles.products } },
      versions: { products: { collection: handles._products_versions } },
      connection: { host: '127.0.0.1', port: 27017, db: { databaseName: 'ecolitea2-test' } },
    },
    logger: { info: vi.fn() },
  }
  return {
    payload,
    documents,
    handles,
    beforeWrite: (callback: () => void) => {
      beforeWrite = callback
    },
  }
}

const wrap = (base: Document, version: boolean) =>
  version ? { _id: 'version', version: base } : { _id: 'product', ...base }
const option = (value: Document, display = 'image') => [
  { id: 'group', name: 'Color', display, values: [{ id: 'row', label: 'Red', ...value }] },
]

describe('product option image / flat specifications migration', () => {
  it.each([false, true])('unsets empty groups with version paths (%s)', (version) => {
    const prefix = version ? 'version.' : ''
    const result = plan(
      wrap(
        {
          specifications: [
            { label: 'A', value: 'B', group: '' },
            { label: 'C', value: 'D', group: null },
            { label: 'E', value: 'F', group: '  ' },
          ],
        },
        version,
      ),
      version,
      'up',
    )
    expect(result.emptyGroups).toBe(3)
    expect(Object.keys(result.unset)).toEqual(
      [0, 1, 2].map((i) => `${prefix}specifications.${i}.group`),
    )
  })
  it.each([
    [{ thumbnail: 'a' }, 'a'],
    [{ gallery: ['a'] }, 'a'],
    [{ thumbnail: 'a', gallery: ['a'] }, 'a'],
    [{ thumbnail: null, gallery: [] }, undefined],
  ])('maps lossless legacy values %j', (legacy, image) => {
    const result = plan({ _id: 'p', options: option(legacy as Document) }, false, 'up')
    const rows = result.set.options as { values: Document[] }[]
    expect(rows[0].values[0]).toEqual({ id: 'row', label: 'Red', ...(image ? { image } : {}) })
    expect(result.ambiguousImages).toEqual([])
  })
  it('does not change values without legacy fields, preserves metadata and is idempotent', async () => {
    const f = fixture(
      [
        {
          _id: 'p',
          options: option({ thumbnail: 'a', extra: { retained: true } }),
          specifications: [{ label: 'A', value: 'B', group: '' }],
        },
      ],
      [{ _id: 'v', version: { options: option({ gallery: ['b'] }) } }],
    )
    await up({ payload: f.payload } as never)
    expect(f.documents.products[0]).toMatchObject({
      options: [{ values: [{ id: 'row', image: 'a', extra: { retained: true } }] }],
      specifications: [{ label: 'A', value: 'B' }],
    })
    expect(f.documents._products_versions[0]).toMatchObject({
      version: { options: [{ values: [{ image: 'b' }] }] },
    })
    expect(
      (await scan(f.payload.db as never, 'up')).collections.every((x) => x.toChangeDocuments === 0),
    ).toBe(true)
  })
  it.each([{ gallery: ['a', 'b'] }, { thumbnail: 'a', gallery: ['b'] }])(
    'blocks ambiguous images %j before every write',
    async (value) => {
      const f = fixture(
        [{ _id: 'safe', options: option({ thumbnail: 'a' }) }],
        [{ _id: 'v', version: { options: option(value) } }],
      )
      await expect(up({ payload: f.payload } as never)).rejects.toThrow('aborted before writes')
      expect(f.handles.products.bulkWrite).not.toHaveBeenCalled()
      expect(f.handles._products_versions.bulkWrite).not.toHaveBeenCalled()
    },
  )
  it('blocks nonempty groups and reports document IDs and row counts', async () => {
    const f = fixture([
      {
        _id: 'p',
        specifications: [
          { group: 'Group', label: 'A', value: 'B' },
          { group: 'Second', label: 'C', value: 'D' },
        ],
      },
    ])
    const r = await scan(f.payload.db as never, 'up')
    expect(r.allowedToWrite).toBe(false)
    expect(r.collections[0].nonemptyGroups).toHaveLength(2)
    expect(r.collections[0].nonemptyGroups[0]).toMatchObject({
      id: 'p',
      path: 'specifications.0.group',
    })
  })
  it.each([
    { options: {} },
    { options: [{ values: {} }] },
    { options: option({ gallery: 'a' }) },
    { options: option({ image: { unexpected: true } }) },
    { specifications: [{ label: 5, value: 'B' }] },
    { specifications: [{ label: 'A', value: 'B', group: 42 }] },
  ])('rejects unknown structures %j', (base) => {
    expect(plan(base, false, 'up').unknown.length).toBeGreaterThan(0)
  })
  it('blocks an existing conflicting image', () => {
    expect(
      plan({ options: option({ thumbnail: 'a', image: 'b' }) }, false, 'up').conflicts,
    ).toHaveLength(1)
  })
  it.each(['text', 'swatch', 'image'])(
    'reverses image for %s without recreating empty groups',
    async (display) => {
      const f = fixture([
        {
          _id: 'p',
          options: option({ image: 'a' }, display),
          specifications: [{ label: 'A', value: 'B' }],
        },
      ])
      await down({ payload: f.payload } as never)
      expect(f.documents.products[0]).toMatchObject({
        options: [{ values: [display === 'image' ? { thumbnail: 'a' } : { gallery: ['a'] }] }],
      })
      expect((await scan(f.payload.db as never, 'down')).collections[0].toChangeDocuments).toBe(0)
      await up({ payload: f.payload } as never)
      expect(f.documents.products[0]).toMatchObject({
        options: [{ values: [{ image: 'a' }] }],
        specifications: [{ label: 'A', value: 'B' }],
      })
    },
  )
  it('guards concurrent changes to either owned array', async () => {
    const f = fixture([{ _id: 'p', options: option({ thumbnail: 'a' }) }])
    f.beforeWrite(() => {
      f.documents.products[0].options = option({ thumbnail: 'changed' })
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow('Concurrent change')
  })
  it('aborts malformed versions and nonlocal targets', async () => {
    const f = fixture([], [{ _id: 'v', version: null }])
    expect((await scan(f.payload.db as never, 'up')).allowedToWrite).toBe(false)
    f.payload.db.connection.host = 'remote'
    await expect(scan(f.payload.db as never, 'up')).rejects.toThrow('allowlisted')
  })
})

it('repairs only explicitly authorized demo fields while retaining labels, values and metadata', async () => {
  const f = fixture([
    {
      _id: 'p',
      specifications: [{ label: 'A', value: 'B', group: 'Demo' }],
      gallery: ['base'],
      options: option({ thumbnail: 'a', gallery: ['a', 'b'], extra: 'keep' }),
    },
  ])
  const strict = await scan(f.payload.db as never, 'up')
  expect(strict.allowedToWrite).toBe(false)
  const repair = await scan(f.payload.db as never, 'up', {}, true)
  expect(repair.allowedToWrite).toBe(true)
  expect(repair.fingerprint).toBe(strict.fingerprint)
  expect(repair.writes[0].operations[0].updateOne.update).toEqual({
    $set: { options: option({ image: 'a', extra: 'keep' }) },
    $unset: { 'specifications.0.group': '' },
  })
})

it('preserves real BSON identifiers and row metadata', () => {
  const require = createRequire(import.meta.url)
  const adapterRequire = createRequire(require.resolve('@payloadcms/db-mongodb'))
  const { BSON } = adapterRequire('mongodb') as { BSON: { ObjectId: new () => unknown } }
  const id = new BSON.ObjectId()
  const result = plan(
    { _id: 'p', options: option({ thumbnail: id, metadata: { at: new Date(0) } }) },
    false,
    'up',
  )
  expect(result.unknown).toEqual([])
  expect(result.set.options).toEqual(option({ image: id, metadata: { at: new Date(0) } }))
})
it('writes batches of at most 250 and forwards the runner session', async () => {
  const f = fixture(
    Array.from({ length: 501 }, (_, i) => ({ _id: `p${i}`, options: option({ thumbnail: 'a' }) })),
  )
  const session = { id: 'session' }
  await up({ payload: f.payload, session } as never)
  expect(f.handles.products.bulkWrite.mock.calls.map(([operations]) => operations.length)).toEqual([
    250, 250, 1,
  ])
  expect(
    f.handles.products.bulkWrite.mock.calls.every(
      ([, options]) => (options as { session: unknown }).session === session,
    ),
  ).toBe(true)
})
