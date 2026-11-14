import { createRequire } from 'node:module'
import { isDeepStrictEqual } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  planProductSectionsBlocksRedesign as plan,
  scanProductSectionsBlocksRedesign as scan,
  up,
  down,
} from '@/migrations/20261111_product_sections_blocks_redesign'

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
            yield* structuredClone(docs)
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

const wrap = (document: Document, version: boolean) => (version ? { version: document } : document)

describe.each([false, true])('Product sections redesign planner (version=%s)', (version) => {
  const prefix = version ? 'version.' : ''

  it('promotes the first explicit theme and reports every destructive replacement', () => {
    const source = {
      sections: [
        {
          label: 'Light',
          blocks: [
            {
              blockType: 'productMediaBanner',
              theme: 'inverse',
              aspectRatio: 'original',
              eyebrow: 'Old',
            },
            {
              blockType: 'productMediaText',
              theme: 'default',
              aspectRatio: 'original',
              title: 'Keep',
            },
            {
              blockType: 'productMediaAccordion',
              defaultMedia: 'fallback',
              items: [
                { title: 'Filled', media: null },
                { title: 'Owned', media: 'own' },
              ],
            },
          ],
        },
      ],
    }
    const input = wrap(source, version)
    const before = structuredClone(input)
    const result = plan(input, version)
    expect(input).toEqual(before)
    expect(result.unknown).toEqual([])
    expect(result.changed).toBe(true)
    expect(result.sections).toEqual([
      {
        label: 'Light',
        theme: 'inverse',
        blocks: [
          { blockType: 'productMediaBanner', aspectRatio: '16:9' },
          { blockType: 'productMediaText', aspectRatio: '4:3', title: 'Keep' },
          {
            blockType: 'productMediaAccordion',
            items: [
              { title: 'Filled', media: 'fallback' },
              { title: 'Owned', media: 'own' },
            ],
          },
        ],
      },
    ])
    expect(result.changes).toEqual(
      expect.arrayContaining([
        {
          path: `${prefix}sections.0.theme`,
          kind: 'theme-promoted',
          before: undefined,
          after: 'inverse',
        },
        {
          path: `${prefix}sections.0.blocks.0.eyebrow`,
          kind: 'eyebrow-removed',
          before: 'Old',
          after: undefined,
        },
        {
          path: `${prefix}sections.0.blocks.1.theme`,
          kind: 'theme-conflict',
          before: 'default',
          after: 'inverse',
        },
        {
          path: `${prefix}sections.0.blocks.0.theme`,
          kind: 'block-theme-removed',
          before: 'inverse',
          after: undefined,
        },
        {
          path: `${prefix}sections.0.blocks.2.items.0.media`,
          kind: 'accordion-media-filled',
          before: null,
          after: 'fallback',
        },
        {
          path: `${prefix}sections.0.blocks.0.aspectRatio`,
          kind: 'ratio-replaced',
          before: 'original',
          after: '16:9',
        },
        {
          path: `${prefix}sections.0.blocks.1.aspectRatio`,
          kind: 'ratio-replaced',
          before: 'original',
          after: '4:3',
        },
        {
          path: `${prefix}sections.0.blocks.2.defaultMedia`,
          kind: 'default-media-removed',
          before: 'fallback',
          after: undefined,
        },
      ]),
    )
    const again = plan(wrap({ sections: result.sections }, version), version)
    expect(again.changed).toBe(false)
    expect(again.changes).toEqual([])
  })

  it.each([
    { themes: [], selected: 'default', conflicts: 0 },
    { themes: [undefined, null], selected: 'default', conflicts: 0 },
    { themes: [null, 'inverse', 'default'], selected: 'inverse', conflicts: 1 },
    { themes: ['default', 'inverse'], selected: 'default', conflicts: 1 },
    { themes: ['inverse', 'inverse'], selected: 'inverse', conflicts: 0 },
  ])('selects an explicit theme or default: %j', ({ themes, selected, conflicts }) => {
    const result = plan(
      wrap(
        {
          sections: [
            { theme: null, blocks: themes.map((theme) => ({ blockType: 'productCode', theme })) },
          ],
        },
        version,
      ),
      version,
    )
    expect(result.unknown).toEqual([])
    expect(result.sections).toEqual([
      { theme: selected, blocks: themes.map(() => ({ blockType: 'productCode' })) },
    ])
    expect(result.changes.filter((change) => change.kind === 'theme-conflict')).toHaveLength(
      conflicts,
    )
    expect(result.changes).toContainEqual({
      path: `${prefix}sections.0.theme`,
      kind: 'theme-promoted',
      before: null,
      after: selected,
    })
  })

  it.each(['default', 'inverse'])('preserves an existing valid section theme: %s', (theme) => {
    const legacy = theme === 'default' ? 'inverse' : 'default'
    const result = plan(
      wrap(
        {
          sections: [
            {
              theme,
              title: 'New title',
              description: 'New description',
              blocks: [{ blockType: 'productCode', theme: legacy }],
            },
          ],
        },
        version,
      ),
      version,
    )
    expect(result.unknown).toEqual([])
    expect(result.sections).toEqual([
      {
        theme,
        title: 'New title',
        description: 'New description',
        blocks: [{ blockType: 'productCode' }],
      },
    ])
    expect(result.changes.filter((change) => change.kind === 'theme-promoted')).toEqual([])
    expect(result.changes).toContainEqual({
      path: `${prefix}sections.0.blocks.0.theme`,
      kind: 'theme-conflict',
      before: legacy,
      after: theme,
    })
  })

  it('removes and records even empty eyebrows across all six block types', () => {
    const types = [
      'productMediaBanner',
      'productMediaCarousel',
      'productMediaTabs',
      'productMediaAccordion',
      'productMediaText',
      'productCode',
    ]
    const eyebrows = ['Text', '', null, undefined, 'Other', 'Code']
    const result = plan(
      wrap(
        {
          sections: [
            { blocks: types.map((blockType, i) => ({ blockType, eyebrow: eyebrows[i] })) },
          ],
        },
        version,
      ),
      version,
    )
    expect(result.unknown).toEqual([])
    expect(result.sections).toEqual([
      { theme: 'default', blocks: types.map((blockType) => ({ blockType })) },
    ])
    expect(result.changes.filter((change) => change.kind === 'eyebrow-removed')).toEqual(
      eyebrows.map((before, i) => ({
        path: `${prefix}sections.0.blocks.${i}.eyebrow`,
        kind: 'eyebrow-removed',
        before,
        after: undefined,
      })),
    )
  })

  it('reports a malformed eyebrow while retaining its exact value in the plan log', () => {
    const result = plan(
      wrap({ sections: [{ blocks: [{ blockType: 'productCode', eyebrow: 42 }] }] }, version),
      version,
    )
    expect(result.unknown).toContainEqual({
      path: `${prefix}sections.0.blocks.0.eyebrow`,
      reason: expect.any(String),
    })
    expect(result.changes).toContainEqual({
      path: `${prefix}sections.0.blocks.0.eyebrow`,
      kind: 'eyebrow-removed',
      before: 42,
      after: undefined,
    })
  })

  it('fills only absent/null accordion media and allows an already migrated accordion', () => {
    const result = plan(
      wrap(
        {
          sections: [
            {
              theme: 'default',
              blocks: [
                {
                  blockType: 'productMediaAccordion',
                  defaultMedia: 0,
                  items: [{ title: 'Absent' }, { media: null }, { media: 'owned' }],
                },
                { blockType: 'productMediaAccordion', items: [{ media: 'already migrated' }] },
              ],
            },
          ],
        },
        version,
      ),
      version,
    )
    expect(result.unknown).toEqual([])
    expect(result.sections).toEqual([
      {
        theme: 'default',
        blocks: [
          {
            blockType: 'productMediaAccordion',
            items: [{ title: 'Absent', media: 0 }, { media: 0 }, { media: 'owned' }],
          },
          { blockType: 'productMediaAccordion', items: [{ media: 'already migrated' }] },
        ],
      },
    ])
    expect(
      result.changes.filter((change) => change.kind === 'accordion-media-filled'),
    ).toHaveLength(2)
  })

  it('preserves BSON, dates, IDs, order and unrelated metadata without cloning their values', () => {
    const require = createRequire(import.meta.url)
    const adapterRequire = createRequire(require.resolve('@payloadcms/db-mongodb'))
    const { BSON } = adapterRequire('mongodb') as { BSON: { ObjectId: new () => unknown } }
    const id = new BSON.ObjectId()
    const updatedAt = new Date('2026-11-01')
    const metadata = { at: updatedAt, id }
    const blocks = [
      {
        blockType: 'productMediaAccordion',
        id,
        defaultMedia: id,
        items: [{ id, media: null, metadata }],
      },
      { blockType: 'productCode', html: '<p>Keep</p>', extra: metadata },
    ]
    const source = { _id: id, sections: [{ id, blocks, metadata }], updatedAt, metadata }
    const input = wrap(source, version)
    const result = plan(input, version)
    expect(result.unknown).toEqual([])
    const sections = result.sections as { id: unknown; blocks: Document[]; metadata: unknown }[]
    const items = sections[0].blocks[0].items as Document[]
    expect(sections).not.toBe(source.sections)
    expect(sections[0].blocks).not.toBe(blocks)
    expect(items).not.toBe(blocks[0].items)
    expect(sections[0].id).toBe(id)
    expect(sections[0].metadata).toBe(metadata)
    expect(items[0].media).toBe(id)
    expect(items[0].id).toBe(id)
    expect(items[0].metadata).toBe(metadata)
    expect(sections[0].blocks[1]).toEqual(blocks[1])
    expect(source.sections[0].blocks[0].items?.[0].media).toBeNull()
    expect(source.updatedAt).toBe(updatedAt)
    expect(source._id).toBe(id)
  })

  it.each([
    { sections: {} },
    { sections: [null] },
    { sections: [{ blocks: {} }] },
    { sections: [{ blocks: [null] }] },
    { sections: [{ blocks: [{ blockType: 'unknown' }] }] },
    { sections: [{ theme: 'unknown', blocks: [] }] },
    { sections: [{ blocks: [{ blockType: 'productCode', theme: '' }] }] },
    { sections: [{ blocks: [{ blockType: 'productCode', theme: 1 }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaText', aspectRatio: 'full-screen' }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaBanner', aspectRatio: '1:1' }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaCarousel', aspectRatio: 'original' }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaTabs', aspectRatio: 42 }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaAccordion', aspectRatio: '' }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaAccordion', items: {} }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaAccordion', items: [null] }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaTabs', tabs: [null] }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaCarousel', slides: {} }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaAccordion', items: [{}] }] }] },
    {
      sections: [
        {
          blocks: [
            { blockType: 'productMediaAccordion', defaultMedia: null, items: [{ media: null }] },
          ],
        },
      ],
    },
    {
      sections: [
        {
          blocks: [
            {
              blockType: 'productMediaAccordion',
              defaultMedia: 'fallback',
              items: [{ media: '' }],
            },
          ],
        },
      ],
    },
    {
      sections: [
        {
          blocks: [
            { blockType: 'productMediaAccordion', defaultMedia: {}, items: [{ media: 'owned' }] },
          ],
        },
      ],
    },
    {
      sections: [
        {
          blocks: [
            {
              blockType: 'productMediaAccordion',
              defaultMedia: 'fallback',
              items: [{ media: { id: 'm' } }],
            },
          ],
        },
      ],
    },
  ])('reports unknown data rather than guessing: %j', (source) => {
    const input = wrap(source, version)
    const before = structuredClone(input)
    const result = plan(input, version)
    expect(result.unknown.length).toBeGreaterThan(0)
    expect(result.unknown.every((issue) => issue.path.startsWith(`${prefix}sections`))).toBe(true)
    expect(input).toEqual(before)
  })

  it.each([undefined, null, []])('accepts an empty draft with sections=%j', (sections) => {
    const result = plan(wrap({ sections }, version), version)
    expect(result.unknown).toEqual([])
    expect(result.changed).toBe(false)
    expect(result.changes).toEqual([])
  })
})

it('rejects a version without its document container', () => {
  expect(plan({}, true).unknown).toEqual([{ path: 'version', reason: expect.any(String) }])
})

const legacySections = () => [
  {
    id: 'section',
    label: 'Film',
    blocks: [
      {
        blockType: 'productMediaBanner',
        media: 'media',
        theme: 'inverse',
        aspectRatio: 'original',
        eyebrow: 'Old',
      },
    ],
  },
]

describe('Product sections redesign runner', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('scans both full collections read-only, then migrates with a forwarded session and is idempotent', async () => {
    const updatedAt = new Date('2026-11-01')
    const f = fixture(
      [
        {
          _id: 'p',
          sections: legacySections(),
          updatedAt,
          deletedAt: new Date(0),
          _status: 'draft',
        },
      ],
      [
        {
          _id: 'v',
          version: { sections: legacySections(), updatedAt },
          latest: true,
          autosave: true,
        },
      ],
    )
    const session = { id: 'session' }
    const report = await scan(f.payload.db as never, { session } as never)
    expect(report).toMatchObject({
      target: { host: '127.0.0.1', port: 27017, databaseName: 'ecolitea2-test' },
      storage: 'not accessed',
      allowedToWrite: true,
      unknown: [],
      collections: [
        { collection: 'products', scanned: 1, toChangeDocuments: 1 },
        { collection: '_products_versions', scanned: 1, toChangeDocuments: 1 },
      ],
    })
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).toHaveBeenCalledWith({}, { session })
      expect(handle.bulkWrite).not.toHaveBeenCalled()
    }
    f.beforeWrite(() => {
      for (const handle of Object.values(f.handles)) expect(handle.find).toHaveBeenCalledTimes(2)
    })
    await up({ payload: f.payload, session } as never)
    for (const root of [
      f.documents.products[0],
      f.documents._products_versions[0].version as Document,
    ]) {
      expect(root.sections).toEqual([
        {
          id: 'section',
          label: 'Film',
          theme: 'inverse',
          blocks: [{ blockType: 'productMediaBanner', media: 'media', aspectRatio: '16:9' }],
        },
      ])
      expect(root.updatedAt).toEqual(updatedAt)
    }
    expect(f.documents.products[0]).toMatchObject({ _status: 'draft', deletedAt: new Date(0) })
    expect(f.documents._products_versions[0]).toMatchObject({ latest: true, autosave: true })
    for (const handle of Object.values(f.handles)) {
      expect(handle.bulkWrite).toHaveBeenCalledTimes(1)
      expect(handle.bulkWrite.mock.calls[0][1]).toEqual({ session })
    }
    const again = await scan(f.payload.db as never)
    expect(again.unknown).toEqual([])
    expect(again.changes).toEqual([])
    expect(again.collections.every((row) => row.toChangeDocuments === 0)).toBe(true)
    await up({ payload: f.payload } as never)
    for (const handle of Object.values(f.handles)) expect(handle.bulkWrite).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])(
    'matches the full original snapshot and reports the target before reads (version=%s)',
    async (version) => {
      const originalSections = legacySections()
      const f = fixture(
        version ? [] : [{ _id: 'p', sections: structuredClone(originalSections) }],
        version ? [{ _id: 'v', version: { sections: structuredClone(originalSections) } }] : [],
      )
      await up({ payload: f.payload } as never)
      const path = version ? 'version.sections' : 'sections'
      const handle = version ? f.handles._products_versions : f.handles.products
      expect(handle.bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({
        _id: version ? 'v' : 'p',
        $and: [
          { [path]: { $exists: true } },
          { $expr: { $eq: [`$${path}`, { $literal: originalSections }] } },
        ],
      })
      expect(f.payload.logger.info.mock.calls[0][0]).toMatchObject({
        msg: expect.stringContaining('127.0.0.1:27017/ecolitea2-test'),
        target: { host: '127.0.0.1', port: 27017, databaseName: 'ecolitea2-test' },
        storage: 'not accessed',
      })
      expect(f.payload.logger.info.mock.calls[0][0].msg).toContain('storage: not accessed')
      expect(f.payload.logger.info.mock.invocationCallOrder[0]).toBeLessThan(
        f.handles.products.find.mock.invocationCallOrder[0],
      )
    },
  )

  it('aborts all writes after finding unusable media in the final version', async () => {
    const f = fixture(
      [{ _id: 'p', sections: legacySections() }],
      [
        { _id: 'v1', version: { sections: legacySections() } },
        {
          _id: 'v2',
          version: {
            sections: [
              { blocks: [{ blockType: 'productMediaAccordion', items: [{ media: null }] }] },
            ],
          },
        },
      ],
    )
    const report = await scan(f.payload.db as never)
    expect(report.allowedToWrite).toBe(false)
    expect(report.unknown).toEqual([
      expect.objectContaining({
        collection: '_products_versions',
        _id: 'v2',
        path: 'version.sections.0.blocks.0.items.0.media',
        reason: expect.stringContaining('cannot invent media'),
      }),
    ])
    expect(report.collections.map((row) => row.scanned)).toEqual([1, 2])
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).toHaveBeenCalledTimes(2)
      expect(handle.bulkWrite).not.toHaveBeenCalled()
    }
    expect(f.payload.logger.info.mock.calls.some(([entry]) => entry.phase === 'applied')).toBe(
      false,
    )
  })

  it('reports missing identifiers before any writes', async () => {
    const f = fixture([{ sections: legacySections() }])
    const report = await scan(f.payload.db as never)
    expect(report.allowedToWrite).toBe(false)
    expect(report.unknown).toContainEqual(
      expect.objectContaining({ collection: 'products', path: '_id' }),
    )
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    for (const handle of Object.values(f.handles)) expect(handle.bulkWrite).not.toHaveBeenCalled()
  })

  it('reports theme conflicts without blocking the chosen section theme', async () => {
    const f = fixture([
      {
        _id: 'p',
        sections: [{ theme: 'default', blocks: [{ blockType: 'productCode', theme: 'inverse' }] }],
      },
    ])
    const report = await scan(f.payload.db as never)
    expect(report.allowedToWrite).toBe(true)
    expect(report.changes).toContainEqual(expect.objectContaining({ kind: 'theme-conflict' }))
    await up({ payload: f.payload } as never)
    expect(f.documents.products[0].sections).toEqual([
      { theme: 'default', blocks: [{ blockType: 'productCode' }] },
    ])
  })

  it.each([false, true])('protects any concurrent section edit (version=%s)', async (version) => {
    const doc: Document = {
      _id: version ? 'v' : 'p',
      ...wrap({ sections: legacySections() }, version),
    }
    const f = fixture(version ? [] : [doc], version ? [doc] : [])
    const base = (version ? doc.version : doc) as Document
    f.beforeWrite(() => {
      ;(base.sections as Document[])[0].description = 'Concurrent'
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/concurrent/i)
    expect((base.sections as Document[])[0].description).toBe('Concurrent')
    expect((base.sections as { blocks: Document[] }[])[0].blocks[0].eyebrow).toBe('Old')
    expect(f.payload.logger.info.mock.calls.some(([entry]) => entry.phase === 'applied')).toBe(
      false,
    )
  })

  it('uses 250-operation batches and stops on a later unmatched snapshot', async () => {
    const f = fixture(
      Array.from({ length: 251 }, (_, i) => ({ _id: `p${i}`, sections: legacySections() })),
      [{ _id: 'v', version: { sections: legacySections() } }],
    )
    let batch = 0
    f.beforeWrite(() => {
      if (++batch === 2) (f.documents.products[250].sections as Document[])[0].label = 'Concurrent'
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(
      /earlier.*applied.*preflight/i,
    )
    expect(
      f.handles.products.bulkWrite.mock.calls.map(([operations]) => operations.length),
    ).toEqual([250, 1])
    expect((f.documents.products[0].sections as Document[])[0].theme).toBe('inverse')
    expect((f.documents.products[250].sections as Document[])[0].label).toBe('Concurrent')
    expect(f.handles._products_versions.bulkWrite).not.toHaveBeenCalled()
    expect(
      f.payload.logger.info.mock.calls.some(
        ([entry]) => entry.phase === 'applied' && entry._id === 'p250',
      ),
    ).toBe(false)
    expect(
      f.payload.logger.info.mock.calls.some(
        ([entry]) => entry.phase === 'applied' && entry._id === 'v',
      ),
    ).toBe(false)
  })

  it('forwards the runner session to every batch of both collections', async () => {
    const f = fixture(
      Array.from({ length: 251 }, (_, i) => ({ _id: `p${i}`, sections: legacySections() })),
      Array.from({ length: 251 }, (_, i) => ({
        _id: `v${i}`,
        version: { sections: legacySections() },
      })),
    )
    const session = { id: 'session' }
    await up({ payload: f.payload, session } as never)
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).toHaveBeenCalledWith({}, { session })
      expect(handle.bulkWrite.mock.calls.map(([operations]) => operations.length)).toEqual([250, 1])
      expect(
        handle.bulkWrite.mock.calls.every(
          ([, options]) => (options as { session: unknown }).session === session,
        ),
      ).toBe(true)
    }
  })

  it('logs each planned/applied change with ID, collection, full path and serializable values', async () => {
    const f = fixture(
      [{ _id: 'p', sections: legacySections() }],
      [{ _id: 'v', version: { sections: legacySections() } }],
    )
    await up({ payload: f.payload } as never)
    for (const phase of ['planned', 'applied']) {
      expect(f.payload.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          phase,
          collection: 'products',
          _id: 'p',
          path: 'sections.0.blocks.0.eyebrow',
          kind: 'eyebrow-removed',
          before: 'Old',
          after: { removed: true },
        }),
      )
      expect(f.payload.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          phase,
          collection: '_products_versions',
          _id: 'v',
          path: 'version.sections.0.theme',
          kind: 'theme-promoted',
          before: { absent: true },
          after: 'inverse',
        }),
      )
      const entries = f.payload.logger.info.mock.calls
        .map(([entry]) => entry)
        .filter((entry) => entry.phase === phase && entry.kind)
      expect(entries).toHaveLength(8)
      for (const entry of entries) {
        const serialized = JSON.parse(JSON.stringify(entry))
        expect(serialized).toHaveProperty('before')
        expect(serialized).toHaveProperty('after')
      }
    }
    const planned = f.payload.logger.info.mock.calls.findIndex(
      ([entry]) => entry.phase === 'planned' && entry.kind,
    )
    const applied = f.payload.logger.info.mock.calls.findIndex(
      ([entry]) => entry.phase === 'applied' && entry.kind,
    )
    expect(planned).toBeLessThan(applied)
    expect(f.payload.logger.info.mock.invocationCallOrder[applied]).toBeGreaterThan(
      f.handles.products.bulkWrite.mock.invocationCallOrder[0],
    )
  })

  it.each([
    { host: 'remote' },
    { host: 'localhost' },
    { port: 27018 },
    { db: { databaseName: 'other' } },
    { db: { databaseName: '' } },
  ])('rejects an unsafe target before any reads: %j', async (target) => {
    const f = fixture()
    Object.assign(f.payload.db.connection, target)
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/allowlisted local/)
    await expect(scan(f.payload.db as never)).rejects.toThrow(/allowlisted local/)
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).not.toHaveBeenCalled()
      expect(handle.bulkWrite).not.toHaveBeenCalled()
    }
  })

  it('rejects production before any reads or writes', async () => {
    const f = fixture()
    vi.stubEnv('NODE_ENV', 'production')
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/allowlisted local/)
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).not.toHaveBeenCalled()
      expect(handle.bulkWrite).not.toHaveBeenCalled()
    }
  })

  it.each(['products', '_products_versions'])(
    'rejects an unexpected collection name: %s',
    async (name) => {
      const f = fixture([{ _id: 'p', sections: legacySections() }])
      f.handles[name].collectionName = 'unexpected'
      await expect(up({ payload: f.payload } as never)).rejects.toThrow(
        /Unexpected Products collection name/,
      )
      expect(f.handles[name].find).not.toHaveBeenCalled()
      for (const handle of Object.values(f.handles)) expect(handle.bulkWrite).not.toHaveBeenCalled()
    },
  )

  it('refuses irreversible down without reading, writing or deleting new fields', async () => {
    const doc = {
      _id: 'p',
      sections: [{ theme: 'inverse', title: 'New title', description: 'New copy', blocks: [] }],
    }
    const before = structuredClone(doc)
    const f = fixture([doc])
    await expect(down({ payload: f.payload } as never)).rejects.toThrow(/Irreversible.*backup/)
    expect(doc).toEqual(before)
    expect(f.payload.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining('storage: not accessed'),
        target: { host: '127.0.0.1', port: 27017, databaseName: 'ecolitea2-test' },
      }),
    )
    for (const handle of Object.values(f.handles)) {
      expect(handle.find).not.toHaveBeenCalled()
      expect(handle.bulkWrite).not.toHaveBeenCalled()
    }
  })
})
