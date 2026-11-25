import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

import { getProductMigrationTarget } from './20261023_products_model_redesign'

type RecordValue = Record<string, unknown>
type Direction = 'up' | 'down'
type Options = { session?: MigrateUpArgs['session'] }
type Issue = { id: string; path: string; reason: string }
type Operation = {
  updateOne: {
    filter: RecordValue
    update: { $rename: Record<string, string> }
    collation: { locale: 'simple' }
  }
}
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<{ matchedCount: number }>
}

const fields = { up: ['content', 'resources'], down: ['resources', 'content'] } as const

const isRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Plan the rename of the product Download relation (`content` → `resources`) for one record. */
export function planResourcesRename(
  document: RecordValue,
  version: boolean,
  direction: Direction,
): { rename?: Record<string, string>; issue?: string } {
  const product = version ? document.version : document
  if (!isRecord(product)) return { issue: 'Expected product version object' }
  const [from, to] = fields[direction]
  if (!Object.hasOwn(product, from)) return {}
  if (Object.hasOwn(product, to)) return { issue: `Both ${from} and ${to} are present` }
  const value = product[from]
  if (value != null && !Array.isArray(value)) return { issue: `Expected ${from} array or null` }
  const prefix = version ? 'version.' : ''
  return { rename: { [`${prefix}${from}`]: `${prefix}${to}` } }
}

/** Scan raw records before writes; the field is no longer part of the Payload schema. */
export async function scanResourcesRename(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
) {
  const target = getProductMigrationTarget(adapter)
  const [from] = fields[direction]
  const collections = []
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  for (const { model, name, version } of [
    { model: adapter.collections.products, name: 'products', version: false },
    { model: adapter.versions.products, name: '_products_versions', version: true },
  ]) {
    const collection = model?.collection as unknown as RawCollection
    if (collection?.collectionName !== name)
      throw new Error(`Unexpected migration collection: ${name}`)
    const path = `${version ? 'version.' : ''}${from}`
    const summary = { collection: name, toRename: 0, issues: [] as Issue[] }
    const operations: Operation[] = []
    for await (const document of collection.find({ [path]: { $exists: true } }, options)) {
      const { rename, issue } = planResourcesRename(document, version, direction)
      if (issue) summary.issues.push({ id: String(document._id), path, reason: issue })
      if (!rename) continue
      const value = (version ? (document.version as RecordValue) : document)[from]
      const [to] = Object.values(rename)
      summary.toRename++
      operations.push({
        updateOne: {
          // Write only if the record still matches the scanned state.
          filter: {
            _id: document._id,
            [to]: { $exists: false },
            $expr: { $eq: [`$${path}`, { $literal: value }] },
          },
          update: { $rename: rename },
          collation: { locale: 'simple' },
        },
      })
    }
    collections.push(summary)
    writes.push({ collection, operations })
  }
  return {
    target,
    direction,
    storage: 'not accessed' as const,
    allowedToWrite: collections.every(({ issues }) => issues.length === 0),
    toRename: collections.reduce((total, row) => total + row.toRename, 0),
    collections,
    writes,
  }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const options = args.session ? { session: args.session } : {}
  const { writes, ...report } = await scanResourcesRename(
    args.payload.db as MongooseAdapter,
    direction,
    options,
  )
  args.payload.logger.info({ msg: 'Product resources rename preflight', report })
  if (!report.allowedToWrite)
    throw new Error('Product resources rename aborted before writes: resolve blocking data')
  for (const { collection, operations } of writes)
    for (let start = 0; start < operations.length; start += 250) {
      const batch = operations.slice(start, start + 250)
      const result = await collection.bulkWrite(batch, options)
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Concurrent change detected in ${collection.collectionName}; some renames may already be applied. Rescan before retrying.`,
        )
    }
}

export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}

export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
