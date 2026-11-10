import { createHash } from 'node:crypto'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

import { assertProductMigrationTarget } from './20261023_products_model_redesign'

type RecordValue = Record<string, unknown>
type Direction = 'up' | 'down'
type Options = { session?: MigrateUpArgs['session'] }
type Issue = { path: string; reason: string }
type Plan = {
  set: RecordValue
  unset: Record<string, ''>
  retiredFields: Record<string, number>
  issues: Issue[]
  regroupedSpecifications: number
  flattenedSpecifications: number
  migratedLegacyHeroes: number
  normalizedSlideThemes: number
}
type Operation = {
  updateOne: {
    filter: RecordValue
    update: { $set?: RecordValue; $unset?: Record<string, ''> }
    collation: { locale: 'simple' }
  }
}
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<{ matchedCount: number }>
}

const productRetiredFields = ['options', 'highlights', 'inquiry']
const settingsFields = ['product.hero', 'product.heroSlides', 'product.inquiry']
const isRecord = (value: unknown): value is RecordValue =>
  value !== null &&
  typeof value === 'object' &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value))
const isTextOrEmpty = (value: unknown): boolean => value == null || typeof value === 'string'
const nonblankText = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim()
const isRawMediaID = (value: unknown): boolean =>
  nonblankText(value) ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'object' &&
    value !== null &&
    '_bsontype' in value &&
    value._bsontype === 'ObjectId')

const emptyPlan = (): Plan => ({
  set: {},
  unset: {},
  retiredFields: {},
  issues: [],
  regroupedSpecifications: 0,
  flattenedSpecifications: 0,
  migratedLegacyHeroes: 0,
  normalizedSlideThemes: 0,
})

// Payload array row identifiers are 24-character hex strings stored in `id`.
const rowID = (document: RecordValue, path: string) =>
  createHash('sha256')
    .update(JSON.stringify([String(document._id), path]))
    .digest('hex')
    .slice(0, 24)

function markRetired(plan: Plan, path: string, field = path) {
  plan.unset[path] = ''
  plan.retiredFields[field] = (plan.retiredFields[field] ?? 0) + 1
}

const isFlatRow = (value: unknown): value is RecordValue =>
  isRecord(value) &&
  !Object.hasOwn(value, 'items') &&
  (Object.hasOwn(value, 'label') || Object.hasOwn(value, 'value')) &&
  isTextOrEmpty(value.label) &&
  isTextOrEmpty(value.value)

const isGroupedRow = (value: unknown): value is RecordValue & { items: RecordValue[] } =>
  isRecord(value) &&
  !Object.hasOwn(value, 'label') &&
  !Object.hasOwn(value, 'value') &&
  isTextOrEmpty(value.group) &&
  Array.isArray(value.items) &&
  value.items.every(isFlatRow)

export function planProductDetailMigration(
  document: RecordValue,
  version: boolean,
  direction: Direction,
): Plan {
  const plan = emptyPlan()
  const product = version ? document.version : document
  const prefix = version ? 'version.' : ''
  if (!isRecord(product)) {
    plan.issues.push({ path: 'version', reason: 'Expected product version object' })
    return plan
  }
  if (direction === 'up')
    for (const field of productRetiredFields)
      if (Object.hasOwn(product, field)) markRetired(plan, `${prefix}${field}`, field)

  const path = `${prefix}specifications`
  const specifications = product.specifications
  if (specifications == null || (Array.isArray(specifications) && specifications.length === 0))
    return plan
  if (!Array.isArray(specifications)) {
    plan.issues.push({ path, reason: 'Expected specifications array or null' })
  } else if (specifications.every(isFlatRow)) {
    if (direction === 'up') {
      plan.set[path] = [{ id: rowID(document, path), group: null, items: specifications }]
      plan.regroupedSpecifications++
    }
  } else if (specifications.every(isGroupedRow)) {
    if (direction === 'down') {
      const hasUnknownGroupData = specifications.some((group) =>
        Object.keys(group).some((key) => !['id', 'group', 'items'].includes(key)),
      )
      if (hasUnknownGroupData)
        plan.issues.push({ path, reason: 'Flattening would discard unrecognized group fields' })
      else {
        plan.set[path] = specifications.flatMap(({ items }) => items)
        plan.flattenedSpecifications++
      }
    }
  } else {
    plan.issues.push({ path, reason: 'Mixed or unexpected specification rows require review' })
  }
  return plan
}

const themeOf = (value: unknown, fallback: 'dark' | 'light') => {
  if (value == null) return fallback
  if (value === 'dark' || value === 'inverse') return 'dark'
  if (value === 'light' || value === 'default') return 'light'
}

export function planProductSettingsMigration(
  document: RecordValue,
  version: boolean,
  direction: Direction,
): Plan {
  const plan = emptyPlan()
  if (direction === 'down') return plan
  const settings = version ? document.version : document
  if (!isRecord(settings)) {
    plan.issues.push({ path: 'version', reason: 'Expected Settings version object' })
    return plan
  }
  const product = settings.product
  const prefix = version ? 'version.product.' : 'product.'
  if (product == null) return plan
  if (!isRecord(product)) {
    plan.issues.push({ path: prefix.slice(0, -1), reason: 'Expected product Settings object' })
    return plan
  }
  if (Object.hasOwn(product, 'inquiry')) markRetired(plan, `${prefix}inquiry`, 'product.inquiry')

  const slidePath = `${prefix}heroSlides`
  const slides = product.heroSlides ?? []
  if (!Array.isArray(slides) || !slides.every(isRecord)) {
    plan.issues.push({ path: slidePath, reason: 'Expected an array of Hero slide objects or null' })
    return plan
  }
  let slidesChanged = false
  const nextSlides = slides.map((slide, index) => {
    const theme = themeOf(slide.theme, 'dark')
    if (!theme) {
      plan.issues.push({
        path: `${slidePath}.${index}.theme`,
        reason: 'Unrecognized Hero slide theme',
      })
      return slide
    }
    const next = { ...slide, theme }
    if (slide.theme !== theme) {
      plan.normalizedSlideThemes++
      slidesChanged = true
    }
    for (const field of ['eyebrow', 'position'])
      if (Object.hasOwn(next, field)) {
        delete (next as RecordValue)[field]
        const countKey = `product.heroSlides[].${field}`
        plan.retiredFields[countKey] = (plan.retiredFields[countKey] ?? 0) + 1
        slidesChanged = true
      }
    return next
  })

  const legacy = product.hero
  const legacyPath = `${prefix}hero`
  if (legacy != null && !isRecord(legacy)) {
    plan.issues.push({ path: legacyPath, reason: 'Expected legacy Hero object or null' })
    return plan
  }
  if (isRecord(legacy) && legacy.enabled === true) {
    const hasUsableSlide = slides.some(
      (slide) =>
        nonblankText(slide.title) && (slide.showText === true || isRawMediaID(slide.media)),
    )
    if (!hasUsableSlide) {
      const theme = themeOf(legacy.headerTheme, 'light')
      if (
        slides.length ||
        !nonblankText(legacy.heading) ||
        !theme ||
        !isTextOrEmpty(legacy.description) ||
        [legacy.image, legacy.mobileMedia].some((media) => media != null && !isRawMediaID(media))
      ) {
        plan.issues.push({
          path: legacyPath,
          reason:
            'An enabled legacy Hero cannot be safely moved alongside incomplete slide or Hero data',
        })
        return plan
      }
      nextSlides.push({
        id: rowID(document, slidePath),
        title: legacy.heading.trim(),
        ...(typeof legacy.description === 'string' ? { description: legacy.description } : {}),
        ...(legacy.image != null ? { media: legacy.image } : {}),
        ...(legacy.mobileMedia != null ? { mobileMedia: legacy.mobileMedia } : {}),
        showText: true,
        enableCta: false,
        theme,
      })
      plan.migratedLegacyHeroes++
      slidesChanged = true
    }
  }
  if (Object.hasOwn(product, 'hero')) markRetired(plan, legacyPath, 'product.hero')
  if (slidesChanged) plan.set[slidePath] = nextSlides
  return plan
}

function snapshotFields(document: RecordValue, paths: string[]) {
  return paths.map((path) => {
    const parts = path.split('.')
    const key = parts.pop()!
    const parent = parts.reduce<unknown>(
      (value, part) => (isRecord(value) ? value[part] : undefined),
      document,
    )
    const exists = isRecord(parent) && Object.hasOwn(parent, key)
    return { path, exists, value: exists ? parent[key] : null }
  })
}

/** Scan raw records before any writes so retired fields are still visible with the new Payload schema. */
export async function scanProductDetailMigration(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
) {
  const target = assertProductMigrationTarget(adapter)
  const { EJSON } = adapter.connection.base.mongo.BSON
  const snapshots: string[] = []
  const collections = []
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  const targets = [
    { model: adapter.collections.products, name: 'products', version: false, settings: false },
    {
      model: adapter.versions.products,
      name: '_products_versions',
      version: true,
      settings: false,
    },
    { model: adapter.globals, name: 'globals', version: false, settings: true },
    { model: adapter.versions.settings, name: '_settings_versions', version: true, settings: true },
  ]

  for (const { model, name, version, settings } of targets) {
    if (direction === 'down' && settings) continue
    const collection = model?.collection as unknown as RawCollection
    if (collection?.collectionName !== name)
      throw new Error(`Unexpected migration collection: ${name}`)
    const selection: RecordValue = name === 'globals' ? { globalType: 'settings' } : {}
    const prefix = version ? 'version.' : ''
    const fields = settings
      ? settingsFields
      : ['specifications', ...(direction === 'up' ? productRetiredFields : [])]
    const paths = fields.map((field) => `${prefix}${field}`)
    const summary = {
      collection: name,
      scanned: 0,
      toChangeDocuments: 0,
      regroupedSpecifications: 0,
      flattenedSpecifications: 0,
      migratedLegacyHeroes: 0,
      normalizedSlideThemes: 0,
      retiredFields: {} as Record<string, number>,
      issues: [] as (Issue & { id: string })[],
    }
    const operations: Operation[] = []
    for await (const document of collection.find(selection, options)) {
      summary.scanned++
      const planner = settings ? planProductSettingsMigration : planProductDetailMigration
      const plan = planner(document, version, direction)
      if (document._id == null)
        plan.issues.push({ path: '_id', reason: 'Missing document identifier' })
      summary.issues.push(...plan.issues.map((issue) => ({ ...issue, id: String(document._id) })))
      const snapshot = snapshotFields(document, paths)
      snapshots.push(EJSON.stringify([name, document._id, snapshot], { relaxed: false }))
      if (plan.issues.length) continue

      const update = {
        ...(Object.keys(plan.set).length ? { $set: plan.set } : {}),
        ...(Object.keys(plan.unset).length ? { $unset: plan.unset } : {}),
      }
      if (!Object.keys(update).length) continue
      summary.toChangeDocuments++
      summary.regroupedSpecifications += plan.regroupedSpecifications
      summary.flattenedSpecifications += plan.flattenedSpecifications
      summary.migratedLegacyHeroes += plan.migratedLegacyHeroes
      summary.normalizedSlideThemes += plan.normalizedSlideThemes
      for (const [field, count] of Object.entries(plan.retiredFields))
        summary.retiredFields[field] = (summary.retiredFields[field] ?? 0) + count

      operations.push({
        updateOne: {
          filter: {
            ...selection,
            _id: document._id,
            $and: snapshot.flatMap(({ path, exists, value }) => [
              { [path]: { $exists: exists } },
              ...(exists ? [{ $expr: { $eq: [`$${path}`, { $literal: value }] } }] : []),
            ]),
          },
          update,
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
    toChangeDocuments: collections.reduce((total, row) => total + row.toChangeDocuments, 0),
    fingerprint: createHash('sha256')
      .update(JSON.stringify([target, direction, snapshots.sort()]))
      .digest('hex'),
    collections,
    writes,
  }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const options = args.session ? { session: args.session } : {}
  const { writes, ...report } = await scanProductDetailMigration(
    args.payload.db as MongooseAdapter,
    direction,
    options,
  )
  args.payload.logger.info({ msg: 'Product detail migration preflight', report })
  if (!report.allowedToWrite)
    throw new Error('Product detail migration aborted before writes: resolve blocking data')
  if (process.env.PRODUCT_DETAIL_SPECS_APPROVED_FINGERPRINT !== report.fingerprint)
    throw new Error(
      'Product detail migration requires the confirmed dry-run fingerprint; rescan before retrying',
    )
  for (const { collection, operations } of writes)
    for (let start = 0; start < operations.length; start += 250) {
      const batch = operations.slice(start, start + 250)
      const result = await collection.bulkWrite(batch, options)
      if (result.matchedCount !== batch.length)
        throw new Error(
          `Concurrent change detected in ${collection.collectionName}; some writes may already be applied. Rescan before retrying.`,
        )
    }
}

export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}

/** Discards group names and IDs. A database backup is required to restore the retired product and Settings fields. */
export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
