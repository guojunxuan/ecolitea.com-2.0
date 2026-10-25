import { isDeepStrictEqual } from 'node:util'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'
import { assertProductMigrationTarget } from './20261023_products_model_redesign'

type RecordValue = Record<string, unknown>
type Direction = 'up' | 'down'
type Issue = { path: string; reason: string }
type Location = Issue & { collection: string; documentIndex: number }
type Options = { session?: MigrateUpArgs['session'] }
type Operation = { updateOne: { filter: RecordValue; update: { $set: RecordValue } } }
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<{ matchedCount: number }>
}
const blockTypes = new Set([
  'productMediaBanner',
  'productMediaCarousel',
  'productMediaTabs',
  'productMediaAccordion',
  'productMediaText',
  'productCode',
])
const legacyHeights = ['heightMode', 'aspectRatio', 'height', 'mobileHeight'] as const
const isRecord = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

/** Copy only owned containers; preserve BSON values and unrelated metadata verbatim. */
export function planProductBlocksRevision(
  document: RecordValue,
  version: boolean,
  direction: Direction,
) {
  const plan = {
    sections: undefined as unknown,
    changed: false,
    toRename: 0,
    unknown: [] as Issue[],
    conflicts: [] as Issue[],
    nonemptyLegacy: [] as Issue[],
  }
  const base = version ? document.version : document
  const prefix = version ? 'version.' : ''
  if (!isRecord(base)) {
    plan.unknown.push({ path: version ? 'version' : '$', reason: 'Expected document object' })
    return plan
  }
  const rename = (record: RecordValue, old: string, next: string, path: string): RecordValue => {
    const result = { ...record }
    let valid = true
    for (const name of [old, next]) {
      if (
        Object.hasOwn(record, name) &&
        record[name] !== null &&
        typeof record[name] !== 'string'
      ) {
        plan.unknown.push({ path: `${path}.${name}`, reason: 'Expected text or null' })
        valid = false
      }
    }
    const [source, target] = direction === 'up' ? [old, next] : [next, old]
    if (!Object.hasOwn(record, source)) return result
    if (Object.hasOwn(record, target) && !isDeepStrictEqual(record[source], record[target])) {
      plan.conflicts.push({ path: `${path}.${source}`, reason: `Source differs from ${target}` })
      return result
    }
    if (!valid) return result
    result[target] = record[source]
    delete result[source]
    plan.toRename++
    return result
  }
  if (base.sections == null) return plan
  if (!Array.isArray(base.sections)) {
    plan.unknown.push({ path: `${prefix}sections`, reason: 'Expected array or null' })
    return plan
  }
  const sections = base.sections.map((section, sectionIndex) => {
    const path = `${prefix}sections.${sectionIndex}`
    if (!isRecord(section)) {
      plan.unknown.push({ path, reason: 'Expected section object' })
      return section
    }
    if (section.blocks == null) return section
    if (!Array.isArray(section.blocks)) {
      plan.unknown.push({ path: `${path}.blocks`, reason: 'Expected array or null' })
      return section
    }
    const blocks = section.blocks.map((block, blockIndex) => {
      const blockPath = `${path}.blocks.${blockIndex}`
      if (
        !isRecord(block) ||
        typeof block.blockType !== 'string' ||
        !blockTypes.has(block.blockType)
      ) {
        plan.unknown.push({ path: blockPath, reason: 'Unknown block structure or blockType' })
        return block
      }
      if (block.blockType === 'productMediaBanner')
        return rename(block, 'content', 'body', blockPath)
      if (block.blockType === 'productMediaTabs' || block.blockType === 'productMediaAccordion') {
        const [array, old] =
          block.blockType === 'productMediaTabs' ? ['tabs', 'label'] : ['items', 'heading']
        if (block[array] == null) return block
        if (!Array.isArray(block[array])) {
          plan.unknown.push({
            path: `${blockPath}.${array}`,
            reason: 'Expected item array or null',
          })
          return block
        }
        return {
          ...block,
          [array]: block[array].map((item, index) => {
            const itemPath = `${blockPath}.${array}.${index}`
            if (!isRecord(item)) {
              plan.unknown.push({ path: itemPath, reason: 'Expected item object' })
              return item
            }
            return rename(item, old, 'title', itemPath)
          }),
        }
      }
      if (block.blockType !== 'productCode' || direction === 'down') return block
      const result = { ...block }
      for (const name of legacyHeights) {
        if (!Object.hasOwn(block, name)) continue
        if (block[name] !== null && block[name] !== '') {
          plan.nonemptyLegacy.push({
            path: `${blockPath}.${name}`,
            reason: 'Nonempty legacy height requires explicit resolution',
          })
        } else delete result[name]
      }
      if (!Object.hasOwn(block, 'minHeight') || block.minHeight === null) result.minHeight = 400
      else if (
        typeof block.minHeight !== 'number' ||
        !Number.isFinite(block.minHeight) ||
        block.minHeight < 100 ||
        block.minHeight > 2000
      ) {
        plan.unknown.push({
          path: `${blockPath}.minHeight`,
          reason: 'Expected minimum height in range 100–2000',
        })
      }
      return result
    })
    return { ...section, blocks }
  })
  plan.sections = sections
  plan.changed = !isDeepStrictEqual(sections, base.sections)
  return plan
}

/** Fully scan main and versions before allowing any write; never initialize storage or run content hooks. */
export async function scanProductBlocksRevision(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
) {
  const target = assertProductMigrationTarget(adapter)
  const report = {
    target,
    direction,
    storage: 'not accessed',
    allowedToWrite: false,
    toRename: 0,
    unknown: [] as Location[],
    conflicts: [] as Location[],
    nonemptyLegacy: [] as Location[],
    collections: [] as { collection: string; scanned: number; toChangeDocuments: number }[],
  }
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  for (const version of [false, true]) {
    const model = version ? adapter.versions.products : adapter.collections.products
    if (!model?.collection) throw new Error('Missing Products collection')
    const collection = model.collection as unknown as RawCollection
    if (collection.collectionName !== (version ? '_products_versions' : 'products'))
      throw new Error('Unexpected Products collection name')
    const row = { collection: collection.collectionName, scanned: 0, toChangeDocuments: 0 }
    const operations: Operation[] = []
    const path = version ? 'version.sections' : 'sections'
    for await (const document of collection.find({}, options)) {
      row.scanned++
      const plan = planProductBlocksRevision(document, version, direction)
      if (!Object.hasOwn(document, '_id') || document._id == null)
        plan.unknown.push({ path: '_id', reason: 'Missing document identifier' })
      for (const kind of ['unknown', 'conflicts', 'nonemptyLegacy'] as const) {
        report[kind].push(
          ...plan[kind].map((issue) => ({
            ...issue,
            collection: row.collection,
            documentIndex: row.scanned,
          })),
        )
      }
      report.toRename += plan.toRename
      if (plan.changed) {
        row.toChangeDocuments++
        const base = (version ? document.version : document) as RecordValue
        operations.push({
          updateOne: {
            filter: {
              _id: document._id,
              $and: [
                { [path]: { $exists: true } },
                { $expr: { $eq: [`$${path}`, { $literal: base.sections }] } },
              ],
            },
            update: { $set: { [path]: plan.sections } },
          },
        })
      }
    }
    report.collections.push(row)
    writes.push({ collection, operations })
  }
  report.allowedToWrite =
    report.unknown.length === 0 &&
    report.conflicts.length === 0 &&
    report.nonemptyLegacy.length === 0
  return { ...report, writes }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const adapter = args.payload.db as MongooseAdapter
  const target = assertProductMigrationTarget(adapter)
  args.payload.logger.info({
    msg: `Product blocks revision (${direction}): ${target.host}:${target.port}/${target.databaseName}; storage: not accessed`,
  })
  const options = args.session ? { session: args.session } : {}
  const { writes, ...report } = await scanProductBlocksRevision(adapter, direction, options)
  args.payload.logger.info({ msg: 'Product blocks revision preflight', report })
  if (!report.allowedToWrite)
    throw new Error(
      `Product blocks revision aborted before writes: unknown=${report.unknown.length}; conflicts=${report.conflicts.length}; nonemptyLegacy=${report.nonemptyLegacy.length}`,
    )
  for (const { collection, operations } of writes) {
    for (let i = 0; i < operations.length; i += 250) {
      const batch = operations.slice(i, i + 250)
      const result = await collection.bulkWrite(batch, options)
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Product blocks revision stopped: ${collection.collectionName} matched ${result.matchedCount} of ${batch.length}; concurrent changes detected. Earlier writes may be partially applied without a transaction; rerun preflight before retrying.`,
        )
    }
  }
}
export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}
/** Reverse renamed text fields; retain minHeight to avoid deleting newly authored data. */
export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
