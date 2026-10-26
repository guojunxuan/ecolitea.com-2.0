import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'
import { assertProductMigrationTarget } from './20261023_products_model_redesign'

type RecordValue = Record<string, unknown>
type Direction = 'up' | 'down'
type Issue = { path: string; reason: string }
type Options = { session?: MigrateUpArgs['session'] }
type Operation = {
  updateOne: { filter: RecordValue; update: { $set?: RecordValue; $unset?: Record<string, ''> } }
}
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<{ matchedCount: number }>
}
const record = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const empty = (value: unknown) => value === undefined || value === null || value === ''
const mediaID = (value: unknown): boolean =>
  (typeof value === 'string' && value.trim().length > 0) ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (value !== null &&
    typeof value === 'object' &&
    '_bsontype' in value &&
    value._bsontype === 'ObjectId' &&
    'toHexString' in value &&
    typeof value.toHexString === 'function')

/** Lossy demo repair is opt-in; development writes also require the approved scan fingerprint. */
export function planProductOptionImageMigration(
  document: RecordValue,
  version: boolean,
  direction: Direction,
  allowDemoRepair = false,
) {
  const plan = {
    set: {} as RecordValue,
    unset: {} as Record<string, ''>,
    mappedImages: 0,
    removedLegacyFields: 0,
    emptyGroups: 0,
    nonemptyGroups: [] as Issue[],
    ambiguousImages: [] as Issue[],
    unknown: [] as Issue[],
    conflicts: [] as Issue[],
  }
  const base = version ? document.version : document
  const prefix = version ? 'version.' : ''
  if (!record(base)) {
    plan.unknown.push({ path: version ? 'version' : '$', reason: 'Expected document object' })
    return plan
  }
  if (base.specifications != null) {
    if (!Array.isArray(base.specifications))
      plan.unknown.push({ path: `${prefix}specifications`, reason: 'Expected array or null' })
    else
      base.specifications.forEach((row, i) => {
        const path = `${prefix}specifications.${i}`
        if (!record(row) || typeof row.label !== 'string' || typeof row.value !== 'string') {
          plan.unknown.push({ path, reason: 'Expected text label/value row' })
          return
        }
        if (!Object.hasOwn(row, 'group')) return
        if (row.group !== null && typeof row.group !== 'string')
          plan.unknown.push({ path: `${path}.group`, reason: 'Expected text or null' })
        else if (typeof row.group === 'string' && row.group.trim()) {
          plan.nonemptyGroups.push({
            path: `${path}.group`,
            reason: 'Nonempty group cannot be discarded without explicit approval',
          })
          if (direction === 'up' && allowDemoRepair) plan.unset[`${path}.group`] = ''
        } else if (direction === 'up') {
          plan.unset[`${path}.group`] = ''
          plan.emptyGroups++
        }
      })
  }
  if (base.options == null) return plan
  if (!Array.isArray(base.options)) {
    plan.unknown.push({ path: `${prefix}options`, reason: 'Expected array or null' })
    return plan
  }
  let changed = false
  const options = base.options.map((group, g) => {
    const path = `${prefix}options.${g}`
    if (!record(group) || (group.values != null && !Array.isArray(group.values))) {
      plan.unknown.push({ path, reason: 'Expected option object with values array or null' })
      return group
    }
    if (group.values == null) return group
    const values = (group.values as unknown[]).map((value, v) => {
      const location = `${path}.values.${v}`
      if (!record(value)) {
        plan.unknown.push({ path: location, reason: 'Expected value object' })
        return value
      }
      const result = { ...value }
      for (const name of ['thumbnail', 'image'])
        if (!empty(value[name]) && !mediaID(value[name]))
          plan.unknown.push({
            path: `${location}.${name}`,
            reason: 'Expected raw media ID or empty value',
          })
      if (
        value.gallery != null &&
        (!Array.isArray(value.gallery) || value.gallery.some((id) => !mediaID(id)))
      ) {
        plan.unknown.push({
          path: `${location}.gallery`,
          reason: 'Expected media ID array or null',
        })
        return result
      }
      if (direction === 'up') {
        const thumbnail = empty(value.thumbnail) ? undefined : value.thumbnail
        const gallery = (value.gallery ?? []) as unknown[]
        if (
          gallery.length > 1 ||
          (thumbnail !== undefined &&
            gallery.length === 1 &&
            !isDeepStrictEqual(thumbnail, gallery[0]))
        ) {
          plan.ambiguousImages.push({
            path: location,
            reason: 'Legacy images cannot map losslessly to one image',
          })
          if (!allowDemoRepair) return result
        }
        const image = thumbnail ?? gallery[0]
        if (image !== undefined) {
          if (!empty(value.image) && !isDeepStrictEqual(value.image, image)) {
            plan.conflicts.push({
              path: `${location}.image`,
              reason: 'Existing image differs from legacy source',
            })
            return result
          }
          result.image = image
          plan.mappedImages++
        }
        for (const name of ['thumbnail', 'gallery'])
          if (Object.hasOwn(value, name)) {
            delete result[name]
            plan.removedLegacyFields++
          }
      } else if (Object.hasOwn(value, 'image')) {
        if (!empty(value.image)) {
          if (!['text', 'swatch', 'image'].includes(String(group.display))) {
            plan.unknown.push({
              path: `${path}.display`,
              reason: 'Cannot reverse an image without a known display type',
            })
            return result
          }
          const name = group.display === 'image' ? 'thumbnail' : 'gallery'
          const legacy = name === 'thumbnail' ? value.image : [value.image]
          if (
            Object.hasOwn(value, name) &&
            !empty(value[name]) &&
            !isDeepStrictEqual(value[name], legacy)
          ) {
            plan.conflicts.push({
              path: `${location}.${name}`,
              reason: 'Existing legacy field differs from image',
            })
            return result
          }
          result[name] = legacy
          plan.mappedImages++
        }
        delete result.image
      }
      if (!isDeepStrictEqual(result, value)) changed = true
      return result
    })
    return { ...group, values }
  })
  if (changed) plan.set[`${prefix}options`] = options
  return plan
}

function snapshotFilter(document: RecordValue, version: boolean) {
  const base = (version ? document.version : document) as RecordValue
  const prefix = version ? 'version.' : ''
  return {
    _id: document._id,
    $and: ['options', 'specifications'].flatMap((field) => {
      const path = `${prefix}${field}`
      const exists = Object.hasOwn(base, field)
      return [
        { [path]: { $exists: exists } },
        ...(exists ? [{ $expr: { $eq: [`$${path}`, { $literal: base[field] }] } }] : []),
      ]
    }),
  }
}

export async function scanProductOptionImageMigration(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
  allowDemoRepair = false,
) {
  const target = assertProductMigrationTarget(adapter)
  const collections = []
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  const snapshots: string[] = []
  for (const version of [false, true]) {
    const model = version ? adapter.versions.products : adapter.collections.products
    const collection = model?.collection as unknown as RawCollection
    const name = version ? '_products_versions' : 'products'
    if (!collection || collection.collectionName !== name)
      throw new Error(`Unexpected migration collection: ${name}`)
    const row = {
      collection: name,
      scanned: 0,
      toChangeDocuments: 0,
      mappedImages: 0,
      removedLegacyFields: 0,
      emptyGroups: 0,
      nonemptyGroups: [] as (Issue & { id: string })[],
      ambiguousImages: [] as (Issue & { id: string })[],
      unknown: [] as (Issue & { id: string })[],
      conflicts: [] as (Issue & { id: string })[],
    }
    const operations: Operation[] = []
    for await (const document of collection.find({}, options)) {
      row.scanned++
      const plan = planProductOptionImageMigration(document, version, direction, allowDemoRepair)
      if (document._id == null)
        plan.unknown.push({ path: '_id', reason: 'Missing document identifier' })
      for (const key of ['nonemptyGroups', 'ambiguousImages', 'unknown', 'conflicts'] as const)
        row[key].push(...plan[key].map((issue) => ({ ...issue, id: String(document._id) })))
      for (const key of ['mappedImages', 'removedLegacyFields', 'emptyGroups'] as const)
        row[key] += plan[key]
      const base = version ? document.version : document
      snapshots.push(
        JSON.stringify([
          name,
          document._id,
          record(base) ? { options: base.options, specifications: base.specifications } : base,
        ]),
      )
      if (Object.keys(plan.set).length || Object.keys(plan.unset).length) {
        row.toChangeDocuments++
        if (record(base))
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
    collections.push(row)
    writes.push({ collection, operations })
  }
  const allowedToWrite = collections.every((row) =>
    (allowDemoRepair
      ? ['unknown', 'conflicts']
      : ['nonemptyGroups', 'ambiguousImages', 'unknown', 'conflicts']
    ).every((key) => (row[key as 'unknown'] as Issue[]).length === 0),
  )
  const fingerprint = createHash('sha256').update(snapshots.sort().join('\n')).digest('hex')
  return {
    target,
    direction,
    demoRepair: allowDemoRepair,
    storage: 'not accessed' as const,
    allowedToWrite,
    fingerprint,
    collections,
    writes,
  }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const { writes, ...report } = await scanProductOptionImageMigration(
    args.payload.db as MongooseAdapter,
    direction,
    args.session ? { session: args.session } : {},
    direction === 'up' && process.env.PRODUCT_OPTION_IMAGE_DEMO_REPAIR === 'true',
  )
  args.payload.logger.info({
    msg: 'Product option image / flat specifications migration preflight',
    report,
  })
  if (!report.allowedToWrite)
    throw new Error(
      'Product option image migration aborted before writes: resolve reported blocking data first',
    )
  if (
    report.target.databaseName === 'ecolitea2' &&
    process.env.PRODUCT_OPTION_IMAGE_APPROVED_FINGERPRINT !== report.fingerprint
  )
    throw new Error(
      'Product option image migration requires the confirmed dry-run fingerprint; rescan before retrying',
    )
  for (const { collection, operations } of writes)
    for (let i = 0; i < operations.length; i += 250) {
      const batch = operations.slice(i, i + 250)
      const result = await collection.bulkWrite(
        batch,
        args.session ? { session: args.session } : {},
      )
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Concurrent change detected in ${collection.collectionName}; earlier batches may have been applied. Rescan before retrying.`,
        )
    }
}
export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}
export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
