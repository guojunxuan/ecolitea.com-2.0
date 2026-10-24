import { isDeepStrictEqual } from 'node:util'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

export type Direction = 'up' | 'down'
type RecordValue = Record<string, unknown>
type LegacyField = 'layout' | 'downloads' | 'faqs'
type Issue = { path: string; reason: string }
type Location = Issue & { collection: string; documentIndex: number }
type Options = { session?: MigrateUpArgs['session'] }
type Operation = {
  updateOne: {
    filter: RecordValue
    update: { $set?: RecordValue; $unset?: Record<string, ''> }
  }
}
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<{ matchedCount: number }>
}
const legacyFields = ['layout', 'downloads', 'faqs'] as const
const counts = (): Record<LegacyField, number> => ({ layout: 0, downloads: 0, faqs: 0 })
const isRecord = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

export type ProductModelPlan = {
  set: RecordValue
  unset: Record<string, ''>
  toRename: number
  toUnset: number
  unknown: Issue[]
  conflicts: Issue[]
  nonemptyLegacy: Record<LegacyField, number>
}

/** Validate only the fields owned by this migration. Extra row metadata is preserved verbatim. */
export function planProductModelMigration(
  document: RecordValue,
  version: boolean,
  direction: Direction,
): ProductModelPlan {
  const plan: ProductModelPlan = {
    set: {},
    unset: {},
    toRename: 0,
    toUnset: 0,
    unknown: [],
    conflicts: [],
    nonemptyLegacy: counts(),
  }
  const base = version && isRecord(document) ? document.version : document
  const prefix = version ? 'version.' : ''
  if (!isRecord(base)) {
    plan.unknown.push({ path: version ? 'version' : '$', reason: 'Expected a document object' })
    return plan
  }
  const valid = (field: string, kind: 'text' | 'specs'): boolean => {
    if (!Object.hasOwn(base, field)) return true
    const value = base[field]
    if (value === null) return true
    if (kind === 'text' && typeof value === 'string') return true
    if (kind === 'specs' && Array.isArray(value)) {
      let okay = true
      value.forEach((row, i) => {
        if (
          !isRecord(row) ||
          typeof row.label !== 'string' ||
          typeof row.value !== 'string' ||
          (Object.hasOwn(row, 'group') && row.group !== null && typeof row.group !== 'string')
        ) {
          plan.unknown.push({
            path: `${prefix}${field}[${i}]`,
            reason:
              'Expected a specification row with text label/value and optional text/null group',
          })
          okay = false
        }
      })
      return okay
    }
    plan.unknown.push({
      path: `${prefix}${field}`,
      reason: kind === 'text' ? 'Expected text or null' : 'Expected specification array or null',
    })
    return false
  }
  for (const [old, next, kind] of [
    ['excerpt', 'summary', 'text'],
    ['specs', 'specifications', 'specs'],
  ] as const) {
    const oldValid = valid(old, kind)
    const nextValid = valid(next, kind)
    const [source, target] = direction === 'up' ? [old, next] : [next, old]
    if (!Object.hasOwn(base, source)) continue
    if (Object.hasOwn(base, target) && !isDeepStrictEqual(base[source], base[target])) {
      plan.conflicts.push({
        path: `${prefix}${source}`,
        reason: `Source differs from ${prefix}${target}`,
      })
      continue
    }
    if (!oldValid || !nextValid) continue
    if (!Object.hasOwn(base, target)) plan.set[`${prefix}${target}`] = base[source]
    plan.unset[`${prefix}${source}`] = ''
    plan.toRename++
  }
  for (const field of legacyFields) {
    if (!Object.hasOwn(base, field)) continue
    const value = base[field]
    if (value === null || (Array.isArray(value) && value.length === 0)) {
      if (direction === 'up') {
        plan.unset[`${prefix}${field}`] = ''
        plan.toUnset++
      }
    } else {
      plan.nonemptyLegacy[field]++
      if (!Array.isArray(value))
        plan.unknown.push({ path: `${prefix}${field}`, reason: 'Expected legacy array or null' })
    }
  }
  return plan
}

/** MongoDB evaluates each condition atomically with the update. $expr compares
 * whole arrays exactly; query-level $eq can also match an array element.
 * Explicit $exists distinguishes absent fields from stored null values.
 */
function snapshotFilter(document: RecordValue, version: boolean): RecordValue {
  const base = (version ? document.version : document) as RecordValue
  const prefix = version ? 'version.' : ''
  const conditions: RecordValue[] = []
  for (const field of ['excerpt', 'summary', 'specs', 'specifications', ...legacyFields]) {
    const path = `${prefix}${field}`
    const exists = Object.hasOwn(base, field)
    conditions.push({ [path]: { $exists: exists } })
    if (exists) conditions.push({ $expr: { $eq: [`$${path}`, { $literal: base[field] }] } })
  }
  return { _id: document._id, $and: conditions }
}

export function assertProductMigrationTarget(adapter: MongooseAdapter) {
  const target = {
    host: adapter.connection.host,
    port: adapter.connection.port,
    databaseName: adapter.connection.db?.databaseName,
  }
  if (
    process.env.NODE_ENV === 'production' ||
    target.host !== '127.0.0.1' ||
    target.port !== 27017 ||
    !target.databaseName ||
    !['ecolitea2', 'ecolitea2-test'].includes(target.databaseName)
  )
    throw new Error(
      'Product model migration requires an allowlisted local development/test database',
    )
  return { ...target, databaseName: target.databaseName }
}

export type ProductModelReport = {
  target: ReturnType<typeof assertProductMigrationTarget>
  direction: Direction
  storage: 'not accessed'
  allowedToWrite: boolean
  toRename: number
  toUnset: number
  nonemptyLegacy: Record<LegacyField, number>
  unknown: Location[]
  conflicts: Location[]
  collections: {
    collection: string
    version: boolean
    scanned: number
    toChangeDocuments: number
    toRename: number
    toUnset: number
    nonemptyLegacy: Record<LegacyField, number>
    unknown: Location[]
    conflicts: Location[]
  }[]
}

/** Complete both raw scans before the caller can perform any writes. Never run model hooks. */
export async function scanProductModelMigration(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
) {
  const target = assertProductMigrationTarget(adapter)
  const report: ProductModelReport = {
    target,
    direction,
    storage: 'not accessed',
    allowedToWrite: false,
    toRename: 0,
    toUnset: 0,
    nonemptyLegacy: counts(),
    unknown: [],
    conflicts: [],
    collections: [],
  }
  const targets = [false, true].map((version) => {
    const model = version ? adapter.versions.products : adapter.collections.products
    if (!model?.collection)
      throw new Error(`Missing products ${version ? 'versions' : 'main'} model`)
    const collection = model.collection as unknown as RawCollection
    if (collection.collectionName !== (version ? '_products_versions' : 'products'))
      throw new Error('Unexpected products migration collection name')
    return { collection, version }
  })
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  for (const { collection, version } of targets) {
    const row: ProductModelReport['collections'][number] = {
      collection: collection.collectionName,
      version,
      scanned: 0,
      toChangeDocuments: 0,
      toRename: 0,
      toUnset: 0,
      nonemptyLegacy: counts(),
      unknown: [],
      conflicts: [],
    }
    const operations: Operation[] = []
    for await (const document of collection.find({}, options)) {
      row.scanned++
      const plan = planProductModelMigration(document, version, direction)
      if (!Object.hasOwn(document, '_id') || document._id === null || document._id === undefined)
        plan.unknown.push({ path: '_id', reason: 'Missing document identifier' })
      for (const kind of ['unknown', 'conflicts'] as const)
        row[kind].push(
          ...plan[kind].map((issue) => ({
            ...issue,
            collection: row.collection,
            documentIndex: row.scanned,
          })),
        )
      row.toRename += plan.toRename
      row.toUnset += plan.toUnset
      for (const field of legacyFields) row.nonemptyLegacy[field] += plan.nonemptyLegacy[field]
      if (Object.keys(plan.unset).length || Object.keys(plan.set).length) {
        row.toChangeDocuments++
        operations.push({
          updateOne: {
            filter: snapshotFilter(document, version),
            update: {
              ...(Object.keys(plan.set).length ? { $set: plan.set } : {}),
              ...(Object.keys(plan.unset).length ? { $unset: plan.unset } : {}),
            },
          },
        })
      }
    }
    report.collections.push(row)
    report.unknown.push(...row.unknown)
    report.conflicts.push(...row.conflicts)
    report.toRename += row.toRename
    report.toUnset += row.toUnset
    for (const field of legacyFields) report.nonemptyLegacy[field] += row.nonemptyLegacy[field]
    writes.push({ collection, operations })
  }
  report.allowedToWrite =
    report.unknown.length === 0 &&
    report.conflicts.length === 0 &&
    Object.values(report.nonemptyLegacy).every((value) => value === 0)
  return { ...report, writes }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const adapter = args.payload.db as MongooseAdapter
  const target = assertProductMigrationTarget(adapter)
  args.payload.logger.info({
    msg: `Product model migration (${direction}) target: ${target.host}:${target.port}/${target.databaseName}; storage: not accessed`,
  })
  const options = args.session ? { session: args.session } : {}
  const { writes, ...report } = await scanProductModelMigration(adapter, direction, options)
  args.payload.logger.info({ msg: 'Product model migration preflight', report })
  if (!report.allowedToWrite)
    throw new Error(
      `Product model migration aborted before writes: unknown=${report.unknown.length}; conflicts=${report.conflicts.length}; nonemptyLegacy=${JSON.stringify(report.nonemptyLegacy)}`,
    )
  for (const { collection, operations } of writes)
    for (let i = 0; i < operations.length; i += 250) {
      const batch = operations.slice(i, i + 250)
      const result = await collection.bulkWrite(batch, options)
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Product model migration stopped: ${collection.collectionName} batch ${i / 250 + 1} matched ${result.matchedCount} of ${batch.length}; concurrent changes detected. Without a transaction, earlier writes may be partially applied; rerun preflight before retrying.`,
        )
    }
}
export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}
export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
