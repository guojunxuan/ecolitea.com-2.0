import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'
import {
  BLOCK_SLUG_MAP,
  planBlockSlugMigration,
  up,
  down,
  scanBlockSlugMigration,
} from '@/migrations/20261021_collection_owned_block_slugs'
import {
  parseReportArguments,
  assertLocalDatabaseURI,
  buildBlockSlugReport,
} from '../../scripts/report-collection-owned-block-slugs'

vi.mock('payload', () => {
  throw new Error('Report import must not load Payload')
})
vi.mock('@/payload.config', () => {
  throw new Error('Report import must not load application config')
})

const lexical = (slugs: string[]) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: slugs.map((blockType) => ({
          type: 'block',
          fields: { blockType, caption: { blockType: 'untouched' } },
        })),
      },
    ],
  },
})
const layouts = (slugs: string[]) =>
  slugs.map((blockType) => ({ blockType, nested: { blockType: 'untouched' } }))
function fixture() {
  const documents: Record<string, Record<string, unknown>[]> = {}
  const collections: Record<string, unknown> = {}
  const versions: Record<string, unknown> = {}
  const handles: Record<string, ReturnType<typeof handle>> = {}
  function handle(name: string) {
    const value = {
      collectionName: name,
      find: vi.fn((filter: Record<string, unknown>, _options?: unknown) => ({
        async *[Symbol.asyncIterator]() {
          for (const doc of documents[name] ?? [])
            if (!filter.globalType || doc.globalType === filter.globalType) yield doc
        },
      })),
      bulkWrite: vi.fn(
        async (
          operations: {
            updateOne: { filter: { _id: unknown }; update: { $set: Record<string, unknown> } }
          }[],
          _options?: unknown,
        ) => {
          for (const { updateOne } of operations)
            Object.assign(
              documents[name].find((doc) => doc._id === updateOne.filter._id)!,
              updateOne.update.$set,
            )
        },
      ),
    }
    handles[name] = value
    return value
  }
  for (const owner of ['pages', 'case-studies', 'blogs', 'posts'] as const) {
    const field = owner === 'pages' || owner === 'case-studies' ? 'layout' : 'content'
    const content =
      field === 'layout'
        ? layouts(Object.keys(BLOCK_SLUG_MAP[owner]))
        : lexical(Object.keys(BLOCK_SLUG_MAP[owner]))
    documents[`custom-${owner}`] = [
      {
        _id: owner,
        [field]: content,
        updatedAt: new Date(),
        deletedAt: new Date(),
        _status: 'draft',
      },
    ]
    documents[`custom-${owner}-versions`] = [
      {
        _id: `${owner}-v`,
        version: { [field]: content, _status: 'draft' },
        autosave: true,
        latest: false,
      },
    ]
    collections[owner] = { collection: handle(`custom-${owner}`) }
    versions[owner] = { collection: handle(`custom-${owner}-versions`) }
  }
  documents['custom-globals'] = [
    {
      _id: 'header',
      globalType: 'header',
      navItems: [
        { content: layouts(['categoryTabs', 'cardGroup']) },
        { content: layouts(['linkGroup', 'richCard']) },
      ],
    },
    { _id: 'footer', globalType: 'footer', navItems: [{ content: layouts(['unrelated']) }] },
  ]
  const globals = { collection: handle('custom-globals') }
  const database = {
    databaseName: 'ecolitea2-test',
    listCollections: vi.fn((_filter?: unknown, _options?: unknown) => ({
      toArray: async () => [],
    })),
    collection: vi.fn((name: string) => handles[name]),
  }
  const payload = {
    db: {
      collections,
      versions,
      globals,
      connection: { host: '127.0.0.1', port: 27017, db: database },
    },
    logger: { info: vi.fn() },
  }
  return { documents, handles, payload, database }
}

describe('collection-owned block migration', () => {
  it('plans the exact contract without changing input or BSON instances', () => {
    const require = createRequire(import.meta.url)
    const adapterRequire = createRequire(require.resolve('@payloadcms/db-mongodb'))
    const { Types } = adapterRequire('mongoose') as { Types: { ObjectId: new () => unknown } }
    const id = new Types.ObjectId()
    const date = new Date()
    const before = { layout: [{ blockType: 'cta', heading: 'Keep', id, date }] }
    const target = { owner: 'pages', type: 'blocks', version: false } as const
    const result = planBlockSlugMigration(before, target, 'up')
    expect(result).toEqual({
      set: { layout: [{ ...before.layout[0], blockType: 'pageCta' }] },
      changes: 1,
      unknown: [],
    })
    expect(before.layout[0].blockType).toBe('cta')
    expect((result.set.layout as typeof before.layout)[0].id).toBe(id)
    expect((result.set.layout as typeof before.layout)[0].date).toBe(date)
    expect(planBlockSlugMigration({ ...before, ...result.set }, target, 'down').set).toEqual(before)
  })

  it('migrates every owner, every version, drafts/trash/autosave and is reversible/idempotent', async () => {
    const f = fixture()
    const original = structuredClone(f.documents)
    await up({ payload: f.payload } as never)
    const report = await scanBlockSlugMigration(f.payload.db as never, 'up')
    expect(report.collections).toHaveLength(9)
    expect(report.collections.every((row) => row.toMigrate.documents === 0)).toBe(true)
    expect(report.collections.reduce((n, row) => n + row.alreadyMigrated, 0)).toBe(34)
    const writes = Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)
    await up({ payload: f.payload } as never)
    expect(Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)).toEqual(writes)
    await down({ payload: f.payload } as never)
    expect(f.documents).toEqual(original)
    expect(f.handles['custom-globals'].find).toHaveBeenCalledWith({ globalType: 'header' }, {})
    expect(f.handles['custom-globals'].bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({
      _id: 'header',
      globalType: 'header',
    })
    expect(f.database.collection).not.toHaveBeenCalled()
  })

  it('handles mixed slugs and children only, ignoring fields and other document paths', () => {
    const input = { content: lexical(['cta', 'blogBanner']), layout: layouts(['unknown']) }
    const result = planBlockSlugMigration(
      input,
      { owner: 'blogs', type: 'lexical', version: false },
      'up',
    )
    expect(result.changes).toBe(1)
    expect(result.unknown).toEqual([])
    expect(result.set).not.toHaveProperty('layout')
  })

  it('collects all unknown/cross-owner/inlineBlock locations before any write', async () => {
    const f = fixture()
    f.documents['custom-posts-versions'].push({
      _id: 'bad',
      version: {
        content: {
          root: {
            children: [
              { type: 'block', fields: { blockType: 'pageCta' } },
              { type: 'inlineBlock', fields: { blockType: 'code' } },
              { type: 'block', fields: { blockType: 'mystery' } },
            ],
          },
        },
      },
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(
      /pageCta.*inlineBlock.*mystery/s,
    )
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
    expect(f.handles['custom-globals'].find).toHaveBeenCalled()
  })

  it.each([false, true])('blocks Header versions (adapter model=%s)', async (adapterModel) => {
    const f = fixture()
    if (adapterModel) Object.assign(f.payload.db.versions, { header: {} })
    else {
      f.database.listCollections.mockReturnValue({
        toArray: async () => [{ name: '_header_versions' }],
      } as never)
      f.database.collection.mockReturnValue({
        findOne: vi.fn().mockResolvedValue({ _id: 'v' }),
      } as never)
    }
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/Header versions/)
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
  })

  it('detects the configured Header version name and reports without writes', async () => {
    const f = fixture()
    Object.assign(f.payload.db, {
      payload: { config: { globals: [{ slug: 'header', dbName: () => 'custom-navigation' }] } },
    })
    f.database.listCollections.mockReturnValue({
      toArray: async () => [{ name: '_custom-navigation_versions' }],
    } as never)
    f.database.collection.mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ _id: 'v' }),
    } as never)
    const report = await buildBlockSlugReport(f.payload.db as never)
    expect(f.database.listCollections.mock.calls[0][0]).toEqual({
      name: { $in: ['_header_versions', '_custom-navigation_versions'] },
    })
    expect(report.headerVersions.collectionsWithDocuments).toEqual(['_custom-navigation_versions'])
    expect(report).not.toHaveProperty('writes')
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
  })

  it('passes the session to reads/writes and batches 250, setting only changed top-level fields', async () => {
    const f = fixture()
    f.documents['custom-pages'] = Array.from({ length: 501 }, (_, i) => ({
      _id: i,
      layout: layouts(['cta']),
      updatedAt: new Date(),
      metadata: { retain: true },
    }))
    const session = { id: 'session' }
    await up({ payload: f.payload, session } as never)
    const h = f.handles['custom-pages']
    expect(h.find).toHaveBeenCalledWith({}, { session })
    expect(h.bulkWrite.mock.calls.map(([ops]) => ops.length)).toEqual([250, 250, 1])
    expect(h.bulkWrite.mock.calls[0][0][0].updateOne.update).toEqual({
      $set: { layout: layouts(['pageCta']) },
    })
    expect(h.bulkWrite.mock.calls[0][1]).toEqual({ session })
  })

  it('preserves absent content on Header link-only items during up and down', () => {
    const link = { label: 'Direct link', link: { url: '/contact' } }
    const before = { navItems: [link, { content: layouts(['richCard']) }] }
    const target = { owner: 'header', type: 'headerGlobal', version: false } as const
    const upPlan = planBlockSlugMigration(before, target, 'up')
    const migrated = { ...before, ...upPlan.set }
    expect(Object.hasOwn((migrated.navItems as typeof before.navItems)[0], 'content')).toBe(false)
    expect((migrated.navItems as typeof before.navItems)[0]).toBe(link)
    const downPlan = planBlockSlugMigration(migrated, target, 'down')
    expect(downPlan.set).toEqual(before)
    expect(Object.hasOwn((downPlan.set.navItems as typeof before.navItems)[0], 'content')).toBe(
      false,
    )
  })

  it('skips empty/missing fields', () => {
    for (const content of [undefined, null, { root: { children: [] } }])
      expect(
        planBlockSlugMigration(
          { content },
          { owner: 'blogs', type: 'lexical', version: false },
          'up',
        ),
      ).toEqual({ set: {}, changes: 0, unknown: [] })
  })
})

describe('read-only report arguments and local environment guard', () => {
  it('defaults to up and supports explicit down only', () => {
    expect(parseReportArguments([])).toBe('up')
    expect(parseReportArguments(['--direction=down'])).toBe('down')
    expect(() => parseReportArguments(['--execute'])).toThrow()
    expect(() => parseReportArguments(['--direction=down', '--direction=down'])).toThrow()
  })
  it('requires the exact explicit local development database without credentials or options', () => {
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
    ])
      expect(() => assertLocalDatabaseURI(uri)).toThrow()
  })
})
