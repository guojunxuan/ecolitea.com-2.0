import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import {
  planProductBlocksRevision,
  scanProductBlocksRevision,
  up,
  down,
} from '@/migrations/20261024_product_blocks_revision'

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

const blocks = [
  { blockType: 'productMediaBanner', content: 'Banner', id: 'banner', media: 'keep' },
  { blockType: 'productMediaTabs', tabs: [{ label: 'Tab', id: 'tab' }] },
  { blockType: 'productMediaAccordion', items: [{ heading: 'Item', body: { arbitrary: true } }] },
  {
    blockType: 'productCode',
    html: '<p>Keep</p>',
    heightMode: null,
    aspectRatio: '',
    height: null,
    mobileHeight: null,
  },
  { blockType: 'productMediaText', title: 'Untouched' },
]
const source = () => ({
  sections: [{ id: 's', label: 'Keep', blocks: structuredClone(blocks) }],
  updatedAt: new Date('2026-01-01'),
})

describe('Product blocks revision migration', () => {
  it('renames main and version fields, adds Code minimum, is idempotent and reverses names', async () => {
    const f = fixture([{ _id: 'p', ...source() }], [{ _id: 'v', version: source(), latest: true }])
    const session = { id: 'test' }
    await up({ payload: f.payload, session } as never)
    for (const root of [
      f.documents.products[0],
      f.documents._products_versions[0].version as Document,
    ]) {
      const result = (root.sections as { blocks: Document[] }[])[0].blocks
      expect(result[0]).toEqual({
        blockType: 'productMediaBanner',
        body: 'Banner',
        id: 'banner',
        media: 'keep',
      })
      expect(result[1]).toMatchObject({ tabs: [{ title: 'Tab', id: 'tab' }] })
      expect(result[2]).toMatchObject({ items: [{ title: 'Item', body: { arbitrary: true } }] })
      expect(result[3]).toEqual({ blockType: 'productCode', html: '<p>Keep</p>', minHeight: 400 })
      expect(result[4]).toEqual(blocks[4])
      expect(root.updatedAt).toEqual(new Date('2026-01-01'))
    }
    expect(f.documents._products_versions[0].latest).toBe(true)
    const calls = Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)
    await up({ payload: f.payload } as never)
    expect(Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)).toEqual(calls)
    await down({ payload: f.payload } as never)
    const root = f.documents.products[0]
    const result = (root.sections as { blocks: Document[] }[])[0].blocks
    expect(result[0]).toHaveProperty('content', 'Banner')
    expect(result[0]).not.toHaveProperty('body')
    expect(result[1]).toMatchObject({ tabs: [{ label: 'Tab' }] })
    expect(result[2]).toMatchObject({ items: [{ heading: 'Item' }] })
    expect(result[3]).toHaveProperty('minHeight', 400)
    const after = Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)
    await down({ payload: f.payload } as never)
    expect(Object.values(f.handles).map((h) => h.bulkWrite.mock.calls.length)).toEqual(after)
    expect(f.handles.products.find).toHaveBeenCalledWith({}, { session })
    expect(f.handles.products.bulkWrite.mock.calls[0][1]).toEqual({ session })
  })
  it.each(['heightMode', 'aspectRatio', 'height', 'mobileHeight'])(
    'aborts all writes when Code has a nonempty legacy %s in the final version',
    async (field) => {
      const f = fixture(
        [{ _id: 'p', ...source() }],
        [
          {
            _id: 'v',
            version: {
              sections: [
                {
                  blocks: [
                    { blockType: 'productCode', [field]: field === 'height' ? 0 : 'stored' },
                  ],
                },
              ],
            },
          },
        ],
      )
      const report = await scanProductBlocksRevision(f.payload.db as never, 'up')
      expect(report.allowedToWrite).toBe(false)
      expect(report.nonemptyLegacy).toHaveLength(1)
      await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
      for (const h of Object.values(f.handles)) {
        expect(h.find).toHaveBeenCalled()
        expect(h.bulkWrite).not.toHaveBeenCalled()
      }
    },
  )
  it.each([
    { sections: {} },
    { sections: [null] },
    { sections: [{ blocks: {} }] },
    { sections: [{ blocks: [null] }] },
    { sections: [{ blocks: [{ blockType: 'unknown' }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaTabs', tabs: [null] }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaAccordion', items: {} }] }] },
    { sections: [{ blocks: [{ blockType: 'productMediaBanner', content: 42 }] }] },
    { sections: [{ blocks: [{ blockType: 'productCode', minHeight: -1 }] }] },
  ])('aborts unknown structures before any writes: %j', async (bad) => {
    const f = fixture([{ _id: 'p', ...source() }], [{ _id: 'v', version: bad }])
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/aborted before writes/)
    for (const h of Object.values(f.handles)) expect(h.bulkWrite).not.toHaveBeenCalled()
  })
  it.each(['up', 'down'] as const)(
    'rejects conflicting rename destinations (%s)',
    async (direction) => {
      const f = fixture([
        {
          _id: 'p',
          sections: [{ blocks: [{ blockType: 'productMediaBanner', content: 'a', body: 'b' }] }],
        },
      ])
      await expect(
        (direction === 'up' ? up : down)({ payload: f.payload } as never),
      ).rejects.toThrow(/aborted before writes/)
      expect(f.handles.products.bulkWrite).not.toHaveBeenCalled()
    },
  )
  it('plans without mutating inputs, preserves nulls, and accepts equal dual fields', () => {
    const doc = {
      sections: [{ blocks: [{ blockType: 'productMediaBanner', content: null, body: null }] }],
    }
    const before = structuredClone(doc)
    const plan = planProductBlocksRevision(doc, false, 'up')
    expect(doc).toEqual(before)
    expect(plan.unknown).toEqual([])
    expect(plan.conflicts).toEqual([])
    expect(plan.sections).toEqual([{ blocks: [{ blockType: 'productMediaBanner', body: null }] }])
  })
  it('protects concurrent section edits with a complete array snapshot', async () => {
    const doc = { _id: 'p', ...source() }
    const f = fixture([doc])
    f.beforeWrite(() => {
      doc.sections[0].label = 'Concurrent'
    })
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/concurrent/)
    expect(doc.sections[0].label).toBe('Concurrent')
    expect(doc.sections[0].blocks[0]).toHaveProperty('content', 'Banner')
  })
  it('rejects unsafe targets before reads', async () => {
    const f = fixture()
    f.payload.db.connection.host = 'remote'
    await expect(up({ payload: f.payload } as never)).rejects.toThrow(/local/)
    for (const h of Object.values(f.handles)) expect(h.find).not.toHaveBeenCalled()
  })
  it('allows empty drafts and rejects missing document identifiers', () => {
    for (const sections of [undefined, null, []])
      expect(planProductBlocksRevision({ sections }, false, 'up').unknown).toEqual([])
    expect(planProductBlocksRevision({}, true, 'up').unknown.length).toBeGreaterThan(0)
  })
})
