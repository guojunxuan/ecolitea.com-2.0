import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

export const BLOCK_SLUG_MAP = {
  pages: {
    cta: 'pageCta',
    content: 'pageContent',
    mediaBlock: 'pageMediaBlock',
    archive: 'pageArchive',
    formBlock: 'pageFormBlock',
  },
  'case-studies': {
    cta: 'caseStudyCta',
    content: 'caseStudyContent',
    mediaBlock: 'caseStudyMediaBlock',
  },
  blogs: {
    mediaBlock: 'blogMediaBlock',
    keyTakeaways: 'blogKeyTakeaways',
    cta: 'blogCta',
    banner: 'blogBanner',
  },
  posts: { banner: 'postBanner', code: 'postCode', mediaBlock: 'postMediaBlock' },
  header: {
    categoryTabs: 'headerCategoryTabs',
    cardGroup: 'headerCardGroup',
    linkGroup: 'headerLinkGroup',
    richCard: 'headerRichCard',
  },
} as const

type Owner = keyof typeof BLOCK_SLUG_MAP
export type Direction = 'up' | 'down'
export type BlockSlugTarget = {
  owner: Owner
  type: 'blocks' | 'lexical' | 'headerGlobal'
  version: boolean
}
type RecordValue = Record<string, unknown>
type UnknownSlug = { path: string; value: unknown }
type Plan = { set: RecordValue; changes: number; unknown: UnknownSlug[] }
type Options = { session?: MigrateUpArgs['session'] }
type Operation = { updateOne: { filter: RecordValue; update: { $set: RecordValue } } }
// Only the raw driver surface is used: model middleware, timestamps and version hooks must not run.
type RawCollection = {
  collectionName: string
  find: (filter: RecordValue, options: Options) => AsyncIterable<RecordValue>
  bulkWrite: (operations: Operation[], options: Options) => Promise<unknown>
}
const isRecord = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function planBlockSlugMigration(
  document: RecordValue,
  target: BlockSlugTarget,
  direction: Direction,
): Plan {
  const result: Plan = { set: {}, changes: 0, unknown: [] }
  const entries = Object.entries(BLOCK_SLUG_MAP[target.owner])
  const mapping: Record<string, string> = Object.fromEntries(
    direction === 'up' ? entries : entries.map(([old, next]) => [next, old]),
  )
  const finished = new Set(Object.values(mapping))
  const rename = (block: RecordValue, path: string): RecordValue => {
    const value = block.blockType
    if (typeof value !== 'string') return block
    if (Object.hasOwn(mapping, value)) {
      result.changes++
      return { ...block, blockType: mapping[value] }
    }
    if (!finished.has(value)) result.unknown.push({ path: `${path}.blockType`, value })
    return block
  }
  const blocks = (value: unknown, path: string): unknown =>
    Array.isArray(value)
      ? value.map((block, i) => (isRecord(block) ? rename(block, `${path}[${i}]`) : block))
      : value
  const lexical = (value: unknown, path: string): unknown => {
    if (!isRecord(value)) return value
    let next = value
    if (value.type === 'inlineBlock') result.unknown.push({ path, value: 'inlineBlock' })
    else if (value.type === 'block' && isRecord(value.fields))
      next = { ...next, fields: rename(value.fields, `${path}.fields`) }
    if (Array.isArray(value.children))
      next = {
        ...next,
        children: value.children.map((child, i) => lexical(child, `${path}.children[${i}]`)),
      }
    return next
  }
  const base = target.version ? document.version : document
  if (!isRecord(base)) return result
  const prefix = target.version ? 'version.' : ''
  let field: string
  let value: unknown
  if (target.type === 'blocks') {
    field = 'layout'
    value = blocks(base.layout, `${prefix}layout`)
  } else if (target.type === 'headerGlobal') {
    field = 'navItems'
    value = Array.isArray(base.navItems)
      ? base.navItems.map((item, i) =>
          isRecord(item) && Array.isArray(item.content)
            ? { ...item, content: blocks(item.content, `${prefix}navItems[${i}].content`) }
            : item,
        )
      : base.navItems
  } else {
    field = 'content'
    value = isRecord(base.content)
      ? { ...base.content, root: lexical(base.content.root, `${prefix}content.root`) }
      : base.content
  }
  if (result.changes)
    result.set = target.version ? { version: { ...base, [field]: value } } : { [field]: value }
  return result
}

export function resolveBlockSlugTargets(adapter: MongooseAdapter) {
  const targets: (BlockSlugTarget & { collection: RawCollection; filter: RecordValue })[] = []
  for (const owner of ['pages', 'case-studies', 'blogs', 'posts'] as const) {
    for (const version of [false, true]) {
      const model = version ? adapter.versions[owner] : adapter.collections[owner]
      if (!model?.collection)
        throw new Error(`Missing migration model: ${owner}${version ? ' versions' : ''}`)
      targets.push({
        owner,
        version,
        type: owner === 'pages' || owner === 'case-studies' ? 'blocks' : 'lexical',
        collection: model.collection as unknown as RawCollection,
        filter: {},
      })
    }
  }
  if (!adapter.globals?.collection) throw new Error('Missing migration Globals model')
  targets.push({
    owner: 'header',
    version: false,
    type: 'headerGlobal',
    collection: adapter.globals.collection as unknown as RawCollection,
    filter: { globalType: 'header' },
  })
  return targets
}

type UnknownLocation = UnknownSlug & { collection: string; _id: unknown }
export type MigrationReport = {
  target: { host: string; port: number; databaseName: string }
  storage: 'unchanged'
  direction: Direction
  headerVersions: { adapterModel: boolean; collectionsWithDocuments: string[] }
  collections: {
    collection: string
    owner: Owner
    version: boolean
    scanned: number
    toMigrate: { documents: number; blocks: number }
    alreadyMigrated: number
    unknown: UnknownLocation[]
  }[]
  unknown: UnknownLocation[]
}

export async function scanBlockSlugMigration(
  adapter: MongooseAdapter,
  direction: Direction,
  options: Options = {},
) {
  const db = adapter.connection.db
  if (!db) throw new Error('Block slug migration requires an open MongoDB connection')
  const report: MigrationReport = {
    target: {
      host: adapter.connection.host,
      port: adapter.connection.port,
      databaseName: db.databaseName,
    },
    storage: 'unchanged',
    direction,
    headerVersions: {
      adapterModel: Boolean(adapter.versions.header),
      collectionsWithDocuments: [],
    },
    collections: [],
    unknown: [],
  }
  const headerConfig = adapter.payload?.config.globals.find(({ slug }) => slug === 'header')
  const configuredName =
    typeof headerConfig?.dbName === 'function' ? headerConfig.dbName({}) : headerConfig?.dbName
  // Match the installed Mongo adapter's version naming convention. Include the
  // default name as well, to catch stale versions after a dbName configuration change.
  const headerVersionNames = [
    ...new Set(['_header_versions', `_${configuredName ?? 'header'}_versions`]),
  ]
  const candidates = await db
    .listCollections({ name: { $in: headerVersionNames } }, { ...options, nameOnly: true })
    .toArray()
  for (const { name } of candidates) {
    if (await db.collection(name).findOne({}, options))
      report.headerVersions.collectionsWithDocuments.push(name)
  }
  const writes: { collection: RawCollection; operations: Operation[] }[] = []
  for (const target of resolveBlockSlugTargets(adapter)) {
    const row: MigrationReport['collections'][number] = {
      collection: target.collection.collectionName,
      owner: target.owner,
      version: target.version,
      scanned: 0,
      toMigrate: { documents: 0, blocks: 0 },
      alreadyMigrated: 0,
      unknown: [],
    }
    const operations: Operation[] = []
    for await (const document of target.collection.find(target.filter, options)) {
      row.scanned++
      const plan = planBlockSlugMigration(document, target, direction)
      const reverse = planBlockSlugMigration(document, target, direction === 'up' ? 'down' : 'up')
      row.alreadyMigrated += reverse.changes
      for (const problem of plan.unknown)
        row.unknown.push({ collection: row.collection, _id: document._id, ...problem })
      if (plan.changes) {
        row.toMigrate.documents++
        row.toMigrate.blocks += plan.changes
        operations.push({
          updateOne: {
            filter: { _id: document._id, ...target.filter },
            update: { $set: plan.set },
          },
        })
      }
    }
    report.collections.push(row)
    report.unknown.push(...row.unknown)
    writes.push({ collection: target.collection, operations })
  }
  return { ...report, writes }
}

async function migrate(args: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const adapter = args.payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) throw new Error('Block slug migration requires an open MongoDB connection')
  // This migration is deliberately restricted to the explicit local development target.
  if (
    adapter.connection.host !== '127.0.0.1' ||
    adapter.connection.port !== 27017 ||
    !['ecolitea2', 'ecolitea2-test'].includes(db.databaseName)
  )
    throw new Error('Block slug migration refuses a non-local development database')
  args.payload.logger.info({
    msg: `Block slug migration (${direction}) target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}; storage: unchanged`,
  })
  const options = args.session ? { session: args.session } : {}
  const report = await scanBlockSlugMigration(adapter, direction, options)
  if (report.headerVersions.adapterModel || report.headerVersions.collectionsWithDocuments.length)
    throw new Error(
      `Header versions detected; migration aborted before writes: ${JSON.stringify(report.headerVersions)}`,
    )
  if (report.unknown.length)
    throw new Error(
      `Unknown block slugs; migration aborted before writes: ${JSON.stringify(report.unknown)}`,
    )
  for (const { collection, operations } of report.writes) {
    for (let i = 0; i < operations.length; i += 250)
      await collection.bulkWrite(operations.slice(i, i + 250), options)
  }
  for (const row of report.collections)
    args.payload.logger.info({
      msg: `${row.collection}: scanned=${row.scanned}; changed documents=${row.toMigrate.documents}; changed blocks=${row.toMigrate.blocks}`,
    })
}

export async function up(args: MigrateUpArgs) {
  await migrate(args, 'up')
}
export async function down(args: MigrateDownArgs) {
  await migrate(args, 'down')
}
