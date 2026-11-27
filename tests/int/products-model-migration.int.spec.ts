import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import { currentProductMigrationFixture } from '../helpers/currentProductMigrationFixture'
import {
  down,
  planProductModelMigration,
  scanProductModelMigration,
  up,
} from '@/migrations/20261023_products_model_redesign'
import {
  assertLocalDatabaseURI,
  buildProductModelReport,
  parseReportArguments,
} from '../../scripts/report-products-model-redesign'

vi.mock('payload', () => {
  throw new Error('Importing report helpers must not initialize Payload')
})
vi.mock('@/payload.config', () => {
  throw new Error('Importing report helpers must not initialize storage/config')
})

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

const specs = [{ group: 'Power', label: 'Voltage', value: '240 V' }]
const legacy = { excerpt: 'Summary text', specs, layout: [], downloads: null, faqs: [] }

describe('product model migration', () => {
  it.each([false, true])(
    'leaves current grouped specifications unchanged (version=%s)',
    (version) => {
      const current = currentProductMigrationFixture()
      const input = version ? { _id: 'v', version: current } : { _id: 'p', ...current }
      const before = structuredClone(input)
      expect(planProductModelMigration(input, version, 'up')).toMatchObject({
        set: {},
        unset: {},
        toRename: 0,
        toUnset: 0,
        unknown: [],
        conflicts: [],
      })
      expect(input).toEqual(before)
    },
  )

  it('accepts grouped draft rows preserved by the detail migration without rewriting them', () => {
    const input = { specifications: [{ group: null, items: [{ label: null }, { value: '' }] }] }
    expect(planProductModelMigration(input, false, 'up')).toMatchObject({
      set: {},
      unset: {},
      unknown: [],
      conflicts: [],
    })
  })

  it('migrates a mixed batch while preserving current main and version documents', async () => {
    const current = { _id: 'current', ...currentProductMigrationFixture() }
    const currentVersion = {
      _id: 'current-v',
      version: currentProductMigrationFixture(),
      latest: true,
    }
    const before = structuredClone([current, currentVersion])
    const f = fixture(
      [{ _id: 'old', ...legacy }, current],
      [{ _id: 'old-v', version: { ...legacy } }, currentVersion],
    )
    const report = await scanProductModelMigration(f.payload.db as never, 'up')
    expect(report.allowedToWrite).toBe(true)
    expect(report.unknown).toEqual([])
    expect(report.collections.map((row) => row.toChangeDocuments)).toEqual([1, 1])
    await up({ payload: f.payload } as never)
    expect(f.documents.products[0]).toEqual({
      _id: 'old',
      summary: legacy.excerpt,
      specifications: specs,
    })
    expect(f.documents._products_versions[0]).toEqual({
      _id: 'old-v',
      version: { summary: legacy.excerpt, specifications: specs },
    })
    expect([current, currentVersion]).toEqual(before)
  })

  it.each(
    [
      [{ group: 'Power', items: 'bad' }],
      [{ group: 42, items: [] }],
      [{ items: [null] }],
      [{ items: [{}] }],
      [{ items: [{ label: 'x', value: 42 }] }],
      [{ items: [{ label: 'x', value: 'y', items: [] }] }],
      [
        { group: null, items: [] },
        { label: 'flat', value: 'row' },
      ],
    ].map((specifications) => ({ specifications })),
  )('rejects malformed or mixed grouped specifications: %j', async ({ specifications }) => {
    const f = fixture([{ _id: 'old', ...legacy }], [{ _id: 'bad-v', version: { specifications } }])
    const report = await scanProductModelMigration(f.payload.db as never, 'up')
    expect(report.allowedToWrite).toBe(false)
    expect(report.unknown.length).toBeGreaterThan(0)
    expect(report.unknown.every((issue) => issue.collection === '_products_versions')).toBe(true)
    const before = structuredClone(f.documents)
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    expect(f.documents).toEqual(before)
  })

  it('does not accept grouped specifications under the legacy specs field', async () => {
    const f = fixture([{ _id: 'bad', specs: currentProductMigrationFixture().specifications }])
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    expect(f.documents.products[0]).toHaveProperty('specs')
    expect(f.documents.products[0]).not.toHaveProperty('specifications')
  })

  it.each([
    currentProductMigrationFixture(),
    { summary: 'Current summary', specifications: currentProductMigrationFixture().specifications },
    { summary: 'Current summary', resources: [], specifications: [] },
    { summary: 'Current summary', sections: currentProductMigrationFixture().sections },
  ])('refuses down on later product shapes before changing any records', async (current) => {
    const f = fixture(
      [{ _id: 'old', summary: 'Old summary', specifications: specs }],
      [{ _id: 'current-v', version: current }],
    )
    const before = structuredClone(f.documents)
    await expect(down({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    expect(f.documents).toEqual(before)
  })

  it.each([false, true])(
    'plans field paths preserving BSON/row metadata (version=%s)',
    (version) => {
      const require = createRequire(import.meta.url)
      const adapterRequire = createRequire(require.resolve('@payloadcms/db-mongodb'))
      const { Types } = adapterRequire('mongoose') as { Types: { ObjectId: new () => unknown } }
      const id = new Types.ObjectId()
      const rows = [{ ...specs[0], id, _id: id, metadata: { date: new Date() } }]
      const source = { ...legacy, specs: rows }
      const input = version ? { _id: id, version: source } : { _id: id, ...source }
      const prefix = version ? 'version.' : ''
      const plan = planProductModelMigration(input, version, 'up')
      expect(plan.set).toEqual({
        [`${prefix}summary`]: legacy.excerpt,
        [`${prefix}specifications`]: rows,
      })
      expect(plan.set[`${prefix}specifications`]).toBe(rows)
      expect(plan.unset).toEqual(
        Object.fromEntries(
          ['excerpt', 'specs', 'layout', 'downloads', 'faqs'].map((key) => [`${prefix}${key}`, '']),
        ),
      )
      expect(plan.toRename).toBe(2)
      expect(plan.toUnset).toBe(3)
      expect(plan.unknown).toEqual([])
      expect(plan.conflicts).toEqual([])
      expect(source.specs).toBe(rows)
      expect(source.excerpt).toBe(legacy.excerpt)
    },
  )

  it('migrates both collections and reverses names while preserving new data and timestamps', async () => {
    const extra = {
      options: [{ arbitrary: true }],
      sections: [{ blocks: [] }],
      inquiry: { mode: 'hidden' },
      updatedAt: new Date(),
      _status: 'draft',
    }
    const f = fixture(
      [{ _id: 'p', ...legacy, ...extra }],
      [{ _id: 'v', version: { ...legacy, ...extra }, autosave: true, latest: false }],
    )
    await up({ payload: f.payload } as never)
    for (const doc of [
      f.documents.products[0],
      f.documents._products_versions[0].version as Document,
    ]) {
      expect(doc).toMatchObject({ summary: legacy.excerpt, specifications: specs, ...extra })
      for (const key of ['excerpt', 'specs', 'layout', 'downloads', 'faqs'])
        expect(doc).not.toHaveProperty(key)
    }
    const calls = Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)
    await up({ payload: f.payload } as never)
    expect(Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)).toEqual(calls)
    await down({ payload: f.payload } as never)
    for (const doc of [
      f.documents.products[0],
      f.documents._products_versions[0].version as Document,
    ]) {
      expect(doc).toMatchObject({ excerpt: legacy.excerpt, specs, ...extra })
      for (const key of ['summary', 'specifications', 'layout', 'downloads', 'faqs'])
        expect(doc).not.toHaveProperty(key)
    }
    const afterDown = Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)
    await down({ payload: f.payload } as never)
    expect(Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)).toEqual(afterDown)
    expect(f.documents._products_versions[0]).toMatchObject({ autosave: true, latest: false })
  })

  it.each(['up', 'down'] as const)(
    'allows same-value fields and rejects differing values (%s)',
    (direction) => {
      const input = {
        excerpt: 'same',
        summary: 'same',
        specs,
        specifications: specs.map((row) => ({ ...row })),
      }
      const plan = planProductModelMigration(input, false, direction)
      expect(plan.toRename).toBe(2)
      expect(plan.conflicts).toEqual([])
      expect(plan.set).toEqual({})
      expect(Object.keys(plan.unset)).toEqual(
        direction === 'up' ? ['excerpt', 'specs'] : ['summary', 'specifications'],
      )
      const conflict = planProductModelMigration(
        { ...input, summary: 'different', specifications: [] },
        false,
        direction,
      )
      expect(conflict.conflicts).toHaveLength(2)
      expect(conflict.set).toEqual({})
      expect(conflict.unset).toEqual({})
    },
  )

  it('preserves null renamed fields, permits absent fields, and only unsets known empty arrays/null', () => {
    const empty = planProductModelMigration({}, false, 'up')
    expect(empty.set).toEqual({})
    expect(empty.unset).toEqual({})
    const plan = planProductModelMigration(
      { excerpt: null, specs: null, layout: null, downloads: [], faqs: null },
      false,
      'up',
    )
    expect(plan.set).toEqual({ summary: null, specifications: null })
    expect(plan.toUnset).toBe(3)
    expect(plan.unknown).toEqual([])
    expect(
      planProductModelMigration({ summary: '', specifications: [] }, false, 'down').set,
    ).toEqual({ excerpt: '', specs: [] })
  })

  it.each(['layout', 'downloads', 'faqs'])(
    'reports any nonempty %s in either collection, scans all, and writes nothing',
    async (field) => {
      for (const version of [false, true]) {
        const bad = { ...legacy, [field]: [{ privateContent: 'must-not-appear' }] }
        const f = fixture(
          [{ _id: 'p', ...(version ? legacy : bad) }],
          [{ _id: 'v', version: version ? bad : legacy }],
        )
        for (const direction of ['up', 'down'] as const) {
          const report = await buildProductModelReport(f.payload.db as never, direction)
          expect(report.nonemptyLegacy[field as 'layout']).toBe(1)
          expect(report.allowedToWrite).toBe(false)
          expect(JSON.stringify(report)).not.toContain('must-not-appear')
          await expect(
            (direction === 'up' ? up : down)({ payload: f.payload } as never),
          ).rejects.toThrow(/aborted before writes/)
          for (const h of Object.values(f.handles)) {
            expect(h.find).toHaveBeenCalled()
            expect(h.bulkWrite).not.toHaveBeenCalled()
          }
        }
      }
    },
  )

  it.each([
    { version: null },
    { version: [] },
    { version: 'bad' },
    {},
    { version: { excerpt: {} } },
    { version: { summary: 4 } },
    { version: { specs: {} } },
    { version: { specifications: [null] } },
    { version: { specs: [{ label: 'No value' }] } },
    { version: { specs: [{ label: 'x', value: 'y', group: 7 }] } },
    { version: { layout: '' } },
    { version: { downloads: {} } },
    { version: { faqs: false } },
  ])('blocks unknown structures without exposing contents: %j', async (bad) => {
    const f = fixture([{ _id: 'safe', ...legacy }], [{ _id: 'bad', ...bad }])
    const report = await buildProductModelReport(f.payload.db as never)
    expect(report.unknown.length).toBeGreaterThan(0)
    expect(report.allowedToWrite).toBe(false)
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
  })

  it('collects multiple blockers from both collections and rejects missing IDs', async () => {
    const f = fixture(
      [{ ...legacy, excerpt: 9, layout: [{}], summary: 'different' }],
      [{ _id: 'v', version: { ...legacy, specs: [null], faqs: [{}] } }],
    )
    const report = await buildProductModelReport(f.payload.db as never)
    expect(report.unknown.map(({ path }) => path)).toEqual(['excerpt', '_id', 'version.specs[0]'])
    expect(report.conflicts).toHaveLength(1)
    expect(report.nonemptyLegacy).toEqual({ layout: 1, downloads: 0, faqs: 1 })
    expect(report.collections.map(({ scanned }) => scanned)).toEqual([1, 1])
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
  })

  it('does not remove even empty legacy fields during down', () => {
    const plan = planProductModelMigration(
      { summary: 'text', layout: [], downloads: null, faqs: [] },
      false,
      'down',
    )
    expect(plan.unset).toEqual({ summary: '' })
    expect(plan.toUnset).toBe(0)
  })

  it.each(['up', 'down'] as const)(
    'conflicts in the last version prevent all writes (%s)',
    async (direction) => {
      const f = fixture(
        [{ _id: 'p', ...legacy }],
        [{ _id: 'v', version: { ...legacy, summary: 'conflicting-secret-content' } }],
      )
      const report = await buildProductModelReport(f.payload.db as never, direction)
      expect(report.conflicts).toHaveLength(1)
      expect(JSON.stringify(report)).not.toContain('conflicting-secret-content')
      expect(report.collections.map((row) => row.scanned)).toEqual([1, 1])
      await expect(
        (direction === 'up' ? up : down)({ payload: f.payload } as never),
      ).rejects.toThrow(/aborted before writes/)
      for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
    },
  )

  it('uses the session for every read/write, batches 250, and read-only reports omit operations', async () => {
    const f = fixture(Array.from({ length: 501 }, (_, _id) => ({ _id, excerpt: 'text' })))
    const report = await buildProductModelReport(f.payload.db as never)
    expect(report).not.toHaveProperty('writes')
    expect(report.toRename).toBe(501)
    expect(report.allowedToWrite).toBe(true)
    expect(f.handles.products.bulkWrite).not.toHaveBeenCalled()
    const session = { id: 'fixture-session' }
    await up({ payload: f.payload, session } as never)
    expect(f.handles.products.find).toHaveBeenCalledWith({}, { session })
    expect(f.handles._products_versions.find).toHaveBeenCalledWith({}, { session })
    expect(f.handles.products.bulkWrite.mock.calls.map(([ops]) => ops.length)).toEqual([
      250, 250, 1,
    ])
    expect(f.handles.products.bulkWrite.mock.calls[0][1]).toEqual({ session })
    expect((await scanProductModelMigration(f.payload.db as never, 'up')).toRename).toBe(0)
  })
})

describe('snapshot conditions protect concurrent edits', () => {
  const cases = [
    { name: 'layout becomes nonempty', field: 'layout', value: [{ content: 'concurrent' }] },
    { name: 'downloads becomes nonempty', field: 'downloads', value: ['concurrent'] },
    { name: 'faqs becomes nonempty', field: 'faqs', value: [{ question: 'concurrent' }] },
    { name: 'source text changes', field: 'source', value: 'concurrent' },
    { name: 'missing destination becomes null', field: 'target', value: null },
    { name: 'missing destination becomes populated', field: 'target', value: 'concurrent' },
    { name: 'null legacy becomes missing', field: 'downloads', remove: true },
    { name: 'missing legacy becomes null', field: 'faqs', initiallyMissing: true, value: null },
  ]
  for (const direction of ['up', 'down'] as const)
    for (const version of [false, true])
      it.each(cases)(
        `${direction} version=${version} preserves $name and reports unmatched writes`,
        async ({ field, value, remove, initiallyMissing }) => {
          const source = direction === 'up' ? 'excerpt' : 'summary'
          const target = direction === 'up' ? 'summary' : 'excerpt'
          const base: Document = { [source]: 'before', layout: [], downloads: null, faqs: [] }
          const path = field === 'source' ? source : field === 'target' ? target : field
          if (initiallyMissing) delete base[path]
          const doc: Document = version ? { _id: 'v', version: base } : { _id: 'p', ...base }
          const f = fixture(version ? [] : [doc], version ? [doc] : [])
          const current = version ? (doc.version as Document) : doc
          f.beforeWrite(() => {
            if (remove) delete current[path]
            else current[path] = value
          })
          await expect(
            (direction === 'up' ? up : down)({ payload: f.payload } as never),
          ).rejects.toThrow(/matched 0 of 1.*concurrent.*partially applied/s)
          expect(Object.hasOwn(current, path)).toBe(!remove)
          if (!remove) expect(current[path]).toEqual(value)
          expect(current[source]).toBe(field === 'source' ? value : 'before')
          if (field !== 'target') expect(current).not.toHaveProperty(target)
        },
      )

  it('stops before the next batch after a mismatch and supports a fresh idempotent scan', async () => {
    const docs = Array.from({ length: 251 }, (_, _id) => ({ _id, excerpt: 'before' }) as Document)
    const f = fixture(docs)
    f.beforeWrite(() => {
      docs[0].excerpt = 'concurrent'
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/matched 249 of 250/)
    expect(f.handles.products.bulkWrite).toHaveBeenCalledTimes(1)
    expect(docs[0]).toEqual({ _id: 0, excerpt: 'concurrent' })
    expect(docs[1]).toEqual({ _id: 1, summary: 'before' })
    expect(docs[250]).toEqual({ _id: 250, excerpt: 'before' })
    f.beforeWrite(() => {})
    await up({ payload: f.payload } as never)
    expect(docs[0]).toEqual({ _id: 0, summary: 'concurrent' })
    expect((await scanProductModelMigration(f.payload.db as never, 'up')).toRename).toBe(0)
  })

  it('guards entire specification arrays and equal dual fields on versions', async () => {
    const base: Document = { excerpt: 'same', summary: 'same', specs, specifications: specs }
    const f = fixture([], [{ _id: 'v', version: base }])
    f.beforeWrite(() => {
      base.specs = [{ ...specs[0], value: 'concurrent', metadata: { keep: true } }]
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/matched 0 of 1/)
    expect(base.excerpt).toBe('same')
    expect(base.specs).toEqual([{ ...specs[0], value: 'concurrent', metadata: { keep: true } }])
    expect(base.specifications).toBe(specs)
  })
})

describe('read-only CLI and target guard', () => {
  it('only accepts direction and requires the explicit credential/query-free local URI', () => {
    expect(parseReportArguments([])).toBe('up')
    expect(parseReportArguments(['--', '--direction=down'])).toBe('down')
    for (const args of [['--apply'], ['--execute'], ['--direction=up', '--direction=up']])
      expect(() => parseReportArguments(args)).toThrow()
    expect(assertLocalDatabaseURI('mongodb://127.0.0.1:27017/ecolitea2')).toEqual({
      host: '127.0.0.1',
      port: 27017,
      databaseName: 'ecolitea2',
    })
    for (const uri of [
      undefined,
      'mongodb://remote/ecolitea2',
      'mongodb://127.0.0.1:27017/production',
      'mongodb://user:secret@127.0.0.1:27017/ecolitea2',
      'mongodb://127.0.0.1:27017/ecolitea2?replicaSet=x',
      'mongodb://127.0.0.1:27017,remote:27017/ecolitea2',
    ])
      expect(() => assertLocalDatabaseURI(uri)).toThrow()
  })

  it.each([{ host: 'remote' }, { port: 27018 }, { db: { databaseName: 'production' } }])(
    'runs on any connected database and plans no writes for current data: %j',
    async (connection) => {
      vi.stubEnv('NODE_ENV', 'production')
      try {
        const f = fixture([])
        Object.assign(f.payload.db.connection, connection)
        await up({ payload: f.payload } as never)
        const report = await buildProductModelReport(f.payload.db as never)
        expect(report.target.databaseName).toBe(f.payload.db.connection.db.databaseName)
        for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllEnvs()
      }
    },
  )

  it('requires an open database connection before scanning', async () => {
    const f = fixture([{ _id: 'p', ...legacy }])
    Object.assign(f.payload.db.connection, { db: undefined })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/open MongoDB connection/)
    for (const h of Object.values(f.handles)) expect(h.find).not.toHaveBeenCalled()
  })
})
