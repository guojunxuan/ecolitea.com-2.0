import { isDeepStrictEqual } from 'node:util'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'
import { getProductMigrationTarget } from './20261023_products_model_redesign'

type RecordValue = Record<string, unknown>
type Issue = { path: string; reason: string }
type Theme = 'default' | 'inverse'
type Change = {
  path: string
  kind:
    | 'eyebrow-removed'
    | 'theme-promoted'
    | 'theme-conflict'
    | 'accordion-media-filled'
    | 'ratio-replaced'
    | 'default-media-removed'
    | 'block-theme-removed'
  before: unknown
  after: unknown
}
type Location = { collection: string; _id: unknown; documentIndex: number }
type LocatedChange = Change & Location
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
// Freeze the migration's accepted vocabulary independently of future block configs.
const ratios: Record<string, readonly string[]> = {
  productMediaBanner: ['full-screen', '21:9', '16:9', 'original'],
  productMediaCarousel: ['21:9', '16:9', '4:3'],
  productMediaTabs: ['21:9', '16:9', '4:3', '1:1'],
  productMediaAccordion: ['4:5', '1:1', '4:3'],
  productMediaText: ['4:5', '1:1', '4:3', '16:9', 'original'],
}
const isRecord = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
const isTheme = (value: unknown): value is Theme => value === 'default' || value === 'inverse'
const isMediaID = (value: unknown): boolean =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (value !== null &&
    typeof value === 'object' &&
    '_bsontype' in value &&
    value._bsontype === 'ObjectId' &&
    'toHexString' in value &&
    typeof value.toHexString === 'function')

/** Copy only owned containers; preserve BSON relationships and unrelated metadata verbatim. */
export function planProductSectionsBlocksRedesign(document: RecordValue, version: boolean) {
  const plan = {
    sections: undefined as unknown,
    changed: false,
    unknown: [] as Issue[],
    changes: [] as Change[],
  }
  const base = version ? document.version : document
  const prefix = version ? 'version.' : ''
  if (!isRecord(base)) {
    plan.unknown.push({ path: version ? 'version' : '$', reason: 'Expected document object' })
    return plan
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
    if (section.theme != null && !isTheme(section.theme))
      plan.unknown.push({ path: `${path}.theme`, reason: 'Expected default, inverse or null' })
    if (section.blocks != null && !Array.isArray(section.blocks)) {
      plan.unknown.push({ path: `${path}.blocks`, reason: 'Expected array or null' })
      return section
    }
    let selected: Theme = isTheme(section.theme) ? section.theme : 'default'
    if (!isTheme(section.theme)) {
      for (const block of section.blocks ?? []) {
        if (!isRecord(block) || !isTheme(block.theme)) continue
        selected = block.theme
        break
      }
    }
    const nextSection: RecordValue = { ...section, theme: selected }
    if (!isTheme(section.theme))
      plan.changes.push({
        path: `${path}.theme`,
        kind: 'theme-promoted',
        before: section.theme,
        after: selected,
      })
    if (section.blocks == null) return nextSection
    nextSection.blocks = section.blocks.map((block, blockIndex) => {
      const blockPath = `${path}.blocks.${blockIndex}`
      if (
        !isRecord(block) ||
        typeof block.blockType !== 'string' ||
        !blockTypes.has(block.blockType)
      ) {
        plan.unknown.push({ path: blockPath, reason: 'Unknown block structure or blockType' })
        return block
      }
      const next = { ...block }
      if (block.eyebrow != null && typeof block.eyebrow !== 'string')
        plan.unknown.push({ path: `${blockPath}.eyebrow`, reason: 'Expected text or null' })
      if (block.theme != null && !isTheme(block.theme))
        plan.unknown.push({
          path: `${blockPath}.theme`,
          reason: 'Expected default, inverse or null',
        })
      if (isTheme(block.theme) && block.theme !== selected)
        plan.changes.push({
          path: `${blockPath}.theme`,
          kind: 'theme-conflict',
          before: block.theme,
          after: selected,
        })
      for (const [field, kind] of [
        ['eyebrow', 'eyebrow-removed'],
        ['theme', 'block-theme-removed'],
      ] as const) {
        if (!Object.hasOwn(block, field)) continue
        plan.changes.push({
          path: `${blockPath}.${field}`,
          kind,
          before: block[field],
          after: undefined,
        })
        delete next[field]
      }
      const allowedRatios = ratios[block.blockType]
      if (
        allowedRatios &&
        block.aspectRatio != null &&
        (typeof block.aspectRatio !== 'string' || !allowedRatios.includes(block.aspectRatio))
      )
        plan.unknown.push({
          path: `${blockPath}.aspectRatio`,
          reason: 'Unknown block aspect ratio',
        })
      if (
        block.aspectRatio === 'original' &&
        (block.blockType === 'productMediaBanner' || block.blockType === 'productMediaText')
      ) {
        next.aspectRatio = block.blockType === 'productMediaBanner' ? '16:9' : '4:3'
        plan.changes.push({
          path: `${blockPath}.aspectRatio`,
          kind: 'ratio-replaced',
          before: block.aspectRatio,
          after: next.aspectRatio,
        })
      }
      const array =
        block.blockType === 'productMediaAccordion'
          ? 'items'
          : block.blockType === 'productMediaTabs'
            ? 'tabs'
            : block.blockType === 'productMediaCarousel'
              ? 'slides'
              : undefined
      if (
        block.blockType === 'productMediaAccordion' &&
        block.defaultMedia != null &&
        !isMediaID(block.defaultMedia)
      )
        plan.unknown.push({
          path: `${blockPath}.defaultMedia`,
          reason: 'Expected raw media relationship',
        })
      if (array && block[array] != null) {
        const items = block[array]
        if (!Array.isArray(items))
          plan.unknown.push({
            path: `${blockPath}.${array}`,
            reason: 'Expected item array or null',
          })
        else
          next[array] = items.map((item, itemIndex) => {
            const itemPath = `${blockPath}.${array}.${itemIndex}`
            if (!isRecord(item)) {
              plan.unknown.push({ path: itemPath, reason: 'Expected item object' })
              return item
            }
            if (block.blockType !== 'productMediaAccordion') return item
            if (item.media != null) {
              if (!isMediaID(item.media))
                plan.unknown.push({
                  path: `${itemPath}.media`,
                  reason: 'Expected raw media relationship',
                })
              return item
            }
            if (!isMediaID(block.defaultMedia)) {
              plan.unknown.push({
                path: `${itemPath}.media`,
                reason: 'Missing item media and no usable defaultMedia; cannot invent media',
              })
              return item
            }
            plan.changes.push({
              path: `${itemPath}.media`,
              kind: 'accordion-media-filled',
              before: item.media,
              after: block.defaultMedia,
            })
            return { ...item, media: block.defaultMedia }
          })
      }
      if (block.blockType === 'productMediaAccordion' && Object.hasOwn(block, 'defaultMedia')) {
        plan.changes.push({
          path: `${blockPath}.defaultMedia`,
          kind: 'default-media-removed',
          before: block.defaultMedia,
          after: undefined,
        })
        delete next.defaultMedia
      }
      return next
    })
    return nextSection
  })
  plan.sections = sections
  plan.changed = !isDeepStrictEqual(sections, base.sections)
  return plan
}

/** Scan all products and versions before allowing writes; do not initialize storage or content hooks. */
export async function scanProductSectionsBlocksRedesign(
  adapter: MongooseAdapter,
  options: Options = {},
) {
  const target = getProductMigrationTarget(adapter)
  const report = {
    target,
    storage: 'not accessed' as const,
    allowedToWrite: false,
    unknown: [] as (Issue & Location)[],
    changes: [] as LocatedChange[],
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
      const plan = planProductSectionsBlocksRedesign(document, version)
      if (!Object.hasOwn(document, '_id') || document._id == null)
        plan.unknown.push({ path: '_id', reason: 'Missing document identifier' })
      const location = {
        collection: row.collection,
        _id: document._id,
        documentIndex: row.scanned,
      }
      report.unknown.push(...plan.unknown.map((issue) => ({ ...issue, ...location })))
      report.changes.push(...plan.changes.map((change) => ({ ...change, ...location })))
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
  report.allowedToWrite = report.unknown.length === 0
  return { ...report, writes }
}

export async function up(args: MigrateUpArgs) {
  const adapter = args.payload.db as MongooseAdapter
  const target = getProductMigrationTarget(adapter)
  args.payload.logger.info({
    msg: `Product sections redesign: ${target.host}:${target.port}/${target.databaseName}; storage: not accessed`,
    target,
    storage: 'not accessed',
  })
  const options = args.session ? { session: args.session } : {}
  const { writes, ...report } = await scanProductSectionsBlocksRedesign(adapter, options)
  const logChange = (change: LocatedChange, phase: 'planned' | 'applied') =>
    args.payload.logger.info({
      msg: `Product sections redesign change ${phase}`,
      phase,
      ...change,
      // Undefined properties disappear from JSON logs; explicit markers retain the full audit trail.
      before: change.before === undefined ? { absent: true } : change.before,
      after: change.after === undefined ? { removed: true } : change.after,
      ...(phase === 'applied' ? { transaction: args.session ? 'pending commit' : 'none' } : {}),
    })
  for (const change of report.changes) logChange(change, 'planned')
  args.payload.logger.info({ msg: 'Product sections redesign preflight', phase: 'planned', report })
  if (!report.allowedToWrite)
    throw new Error(
      `Product sections redesign aborted before writes: unknown=${report.unknown.length}`,
    )
  for (const { collection, operations } of writes) {
    const changesByID = new Map<unknown, LocatedChange[]>()
    for (const change of report.changes) {
      if (change.collection !== collection.collectionName) continue
      const changes = changesByID.get(change._id) ?? []
      changes.push(change)
      changesByID.set(change._id, changes)
    }
    for (let index = 0; index < operations.length; index += 250) {
      const batch = operations.slice(index, index + 250)
      const result = await collection.bulkWrite(batch, options)
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Concurrent section changes in ${collection.collectionName}: matched ${result.matchedCount} of ${batch.length}; earlier batches and the current batch may be partially applied without a transaction. Rerun preflight before retrying.`,
        )
      for (const operation of batch)
        for (const change of changesByID.get(operation.updateOne.filter._id) ?? [])
          logChange(change, 'applied')
    }
  }
  args.payload.logger.info({
    msg: 'Product sections redesign matched all planned updates',
    phase: 'applied',
    transaction: args.session ? 'pending commit' : 'none',
    collections: writes.map(({ collection, operations }) => ({
      collection: collection.collectionName,
      matchedDocuments: operations.length,
    })),
    changes: report.changes.length,
  })
}

/** Deleted legacy values cannot be reconstructed; restore the local backup and matching application code. */
export async function down({ payload }: MigrateDownArgs) {
  const target = getProductMigrationTarget(payload.db as MongooseAdapter)
  payload.logger.info({
    msg: 'Product sections redesign rollback unavailable; storage: not accessed',
    target,
    storage: 'not accessed',
  })
  throw new Error(
    'Irreversible product sections redesign: restore the pre-migration local database backup together with the matching application revision. Removed eyebrow values, block themes, defaultMedia provenance and original ratios cannot be reconstructed.',
  )
}
