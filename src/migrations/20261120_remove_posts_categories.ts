import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

type Database = NonNullable<MongooseAdapter['connection']['db']>
type ObjectID = InstanceType<MongooseAdapter['connection']['base']['mongo']['ObjectId']>
type DocumentID = ObjectID | string | number
type RawDocument = Record<string, unknown> & { _id: DocumentID }
type RecordValue = Record<string, unknown>
type Direction = 'up' | 'down'

const retired = ['posts', 'categories'] as const
type RetiredCollection = (typeof retired)[number]
const versionCollectionName = <T extends string>(slug: T): `_${T}_versions` => `_${slug}_versions`
const retiredVersions = retired.map(versionCollectionName)
const retiredNamespaces = [...retired, ...retiredVersions]
const excludedReferenceNamespaces = [...retiredNamespaces, 'search', 'translation-search']
const archiveCollections = ['pages', versionCollectionName('pages')]
const searchRows = { 'doc.relationTo': 'posts' }
const translationSearchRows = { sourceCollection: 'posts' }

type Location = { collection: string; id: string; globalType?: string }
type Reference = { path: string; target: RetiredCollection; kind: 'relationship' | 'archive' }
type ReferenceLocation = Location & { path: string; target: RetiredCollection }
type ArchiveChange = { path: string; original: RecordValue; relationTo: 'posts' | 'blogs' }
type PlannedArchive = ArchiveChange & { collection: string; id: DocumentID }
type VersionLocation = { id: string; parent: string | null }
type VersionInventory = { retained: VersionLocation[]; orphaned: VersionLocation[] }
type Blockers = {
  documents: (Location & { slug?: string; status?: string })[]
  relationships: ReferenceLocation[]
  archives: ReferenceLocation[]
  redirects: ReferenceLocation[]
  translations: ReferenceLocation[]
}

function isRecord(value: unknown): value is RecordValue {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isRetired(value: unknown): value is RetiredCollection {
  return value === 'posts' || value === 'categories'
}

function archiveChoices(value: unknown, path: string) {
  return Array.isArray(value)
    ? value.map((entry, index) => ({ entry, path: `${path}.${index}` }))
    : [{ entry: value, path }]
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== ''
}

export function planContentDocument(
  document: RecordValue,
  collection: string,
  direction: Direction = 'up',
) {
  const references: Reference[] = []
  const archiveReferencePaths = new Set<string>()
  const archiveChanges: ArchiveChange[] = []
  const archiveSource = archiveCollections.includes(collection)

  function visit(value: unknown, path: string) {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}.${index}`))
      return
    }
    if (!isRecord(value)) return

    const isArchive =
      archiveSource && (value.blockType === 'pageArchive' || value.blockType === 'archive')
    if (isArchive) {
      const choices = [
        ...archiveChoices(value.categories, `${path}.categories`).map((choice) => ({
          ...choice,
          legacyTarget: 'categories' as const,
        })),
        ...archiveChoices(value.selectedDocs, `${path}.selectedDocs`).map((choice) => ({
          ...choice,
          legacyTarget: 'posts' as const,
        })),
      ].filter(({ entry }) => hasValue(entry))

      for (const choice of choices) {
        // Categories were stored as bare IDs. Keep valid Blog category IDs and explicit Blog selections.
        const target =
          isRecord(choice.entry) && typeof choice.entry.relationTo === 'string'
            ? choice.entry.relationTo
            : value.relationTo === 'blogs'
              ? undefined
              : choice.legacyTarget
        if (isRetired(target)) {
          references.push({ path: choice.path, target, kind: 'archive' })
          archiveReferencePaths.add(choice.path)
        }
      }

      if (value.populateBy === 'collection') {
        if (direction === 'up' && value.relationTo === 'posts') {
          archiveChanges.push({ path, original: value, relationTo: 'blogs' })
        }
        // An empty, collection-populated Blog Archive has no stored origin. Down is for
        // a code rollback in a quiet write window, before editors create new such blocks.
        if (direction === 'down' && value.relationTo === 'blogs' && choices.length === 0) {
          archiveChanges.push({ path, original: value, relationTo: 'posts' })
        }
      }
    }

    // The Archive's own legacy Posts selector is configuration, not a document reference.
    if (
      isRetired(value.relationTo) &&
      !(isArchive && value.relationTo === 'posts') &&
      !archiveReferencePaths.has(path)
    ) {
      references.push({ path, target: value.relationTo, kind: 'relationship' })
    }

    for (const [key, child] of Object.entries(value)) {
      visit(child, path ? `${path}.${key}` : key)
    }
  }

  visit(document, '')
  return { references, archiveChanges }
}

async function planArchives(db: Database, direction: Direction) {
  const changes: PlannedArchive[] = []
  for (const collection of archiveCollections) {
    for await (const document of db.collection<RawDocument>(collection).find()) {
      const plan = planContentDocument(document, collection, direction)
      for (const change of plan.archiveChanges)
        changes.push({ collection, id: document._id, ...change })
    }
  }
  return changes
}

export async function scanRemovePostsCategories(db: Database) {
  const blockers: Blockers = {
    documents: [],
    relationships: [],
    archives: [],
    redirects: [],
    translations: [],
  }
  const versions: Record<(typeof retiredVersions)[number], VersionInventory> = {
    _posts_versions: { retained: [], orphaned: [] },
    _categories_versions: { retained: [], orphaned: [] },
  }
  const changes: PlannedArchive[] = []

  for (const collection of retired) {
    const parents = new Set<string>()
    for await (const { _id, slug, _status } of db
      .collection<RawDocument>(collection)
      .find({}, { projection: { slug: 1, _status: 1 } })
      .sort({ _id: 1 })) {
      const id = String(_id)
      parents.add(id)
      blockers.documents.push({
        collection,
        id,
        ...(typeof slug === 'string' ? { slug } : {}),
        ...(typeof _status === 'string' ? { status: _status } : {}),
      })
    }
    const namespace = versionCollectionName(collection)
    for await (const { _id, parent } of db
      .collection<RawDocument>(namespace)
      .find({}, { projection: { parent: 1 } })
      .sort({ _id: 1 })) {
      const parentId = parent == null ? null : String(parent)
      const bucket = parentId !== null && parents.has(parentId) ? 'retained' : 'orphaned'
      versions[namespace][bucket].push({ id: String(_id), parent: parentId })
    }
  }

  const namespaces = await db.listCollections({}, { nameOnly: true }).toArray()
  const sources = namespaces
    .map(({ name }) => name)
    .filter((name) => !excludedReferenceNamespaces.includes(name))
    .sort()
  for (const collection of sources) {
    for await (const document of db.collection<RawDocument>(collection).find().sort({ _id: 1 })) {
      const id = String(document._id)
      const location: Location = { collection, id }
      if (collection === 'globals' && typeof document.globalType === 'string') {
        location.globalType = document.globalType
      }
      const plan = planContentDocument(document, collection)
      for (const { kind, path, target } of plan.references) {
        const reference = { ...location, path, target }
        if (kind === 'archive') blockers.archives.push(reference)
        else if (collection === 'redirects' && path === 'to.reference') {
          blockers.redirects.push(reference)
        } else blockers.relationships.push(reference)
      }
      for (const change of plan.archiveChanges)
        changes.push({ collection, id: document._id, ...change })
    }
  }

  for await (const { _id, sourceCollection } of db
    .collection<RawDocument>('translations')
    .find({ sourceCollection: { $in: retired } }, { projection: { sourceCollection: 1 } })
    .sort({ _id: 1 })) {
    if (isRetired(sourceCollection)) {
      blockers.translations.push({
        collection: 'translations',
        id: String(_id),
        path: 'sourceCollection',
        target: sourceCollection,
      })
    }
  }

  const existing = new Set(namespaces.map(({ name }) => name))
  const blockerCounts = {
    documents: blockers.documents.length,
    relationships: blockers.relationships.length,
    archives: blockers.archives.length,
    redirects: blockers.redirects.length,
    translations: blockers.translations.length,
  }
  const blockerCount = Object.values(blockerCounts).reduce((total, count) => total + count, 0)
  const report = {
    database: db.databaseName,
    blockers,
    blockerCount,
    blockerCounts,
    versions,
    versionCounts: {
      _posts_versions: {
        retained: versions._posts_versions.retained.length,
        orphaned: versions._posts_versions.orphaned.length,
      },
      _categories_versions: {
        retained: versions._categories_versions.retained.length,
        orphaned: versions._categories_versions.orphaned.length,
      },
    },
    planned: {
      archiveBlocks: changes.length,
      searchRows: await db.collection('search').countDocuments(searchRows),
      translationSearchRows: await db
        .collection('translation-search')
        .countDocuments(translationSearchRows),
      collections: retiredNamespaces.filter((name) => existing.has(name)),
    },
  }
  return { report, changes }
}

async function applyArchiveChanges(
  db: Database,
  changes: PlannedArchive[],
  session: MigrateUpArgs['session'],
) {
  let archiveBlocks = 0
  for (const { collection, id, path, original, relationTo } of changes) {
    // Compare the original block at its index so a concurrent reorder or edit cannot alter a different block.
    const result = await db
      .collection<RawDocument>(collection)
      .updateOne(
        { _id: id, [path]: { $eq: original } },
        { $set: { [`${path}.relationTo`]: relationTo } },
        { session },
      )
    if (result.matchedCount !== 1)
      throw new Error(`Archive changed after preflight: ${collection}:${id}:${path}`)
    archiveBlocks += result.modifiedCount
  }
  return archiveBlocks
}

function migrationTarget({ payload }: MigrateUpArgs | MigrateDownArgs, direction: Direction) {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection?.db
  if (!db) throw new Error('Remove Posts and Categories requires an open MongoDB connection')
  payload.logger.info({
    msg: `Remove Posts and Categories (${direction}) target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}; storage unchanged`,
  })
  return db
}

export async function up(args: MigrateUpArgs) {
  const db = migrationTarget(args, 'up')
  const { report, changes } = await scanRemovePostsCategories(db)
  if (report.blockerCount) {
    throw new Error(`Remove Posts and Categories blocked before writes: ${JSON.stringify(report)}`)
  }

  // MongoDB drop cannot run in Payload's transaction. Quiesce content writers during migration.
  // Dropping only empty collections or versions with absent parents makes this phase safe to retry.
  for (const collection of retired) {
    const document = await db.collection(collection).findOne({}, { projection: { _id: 1 } })
    if (document)
      throw new Error(
        `Remove Posts and Categories blocked before writes: ${collection}:${document._id}`,
      )
  }
  const dropped: string[] = []
  for (const name of report.planned.collections) {
    const liveCollection = name.replace(/^_(.+)_versions$/, '$1')
    const document = await db.collection(liveCollection).findOne({}, { projection: { _id: 1 } })
    if (document)
      throw new Error(
        `Cannot drop ${name}: ${liveCollection}:${document._id} appeared after preflight`,
      )
    if (await db.collection(name).drop()) dropped.push(name)
  }

  const { session } = args
  const archiveBlocks = await applyArchiveChanges(db, changes, session)
  const search = await db.collection('search').deleteMany(searchRows, { session })
  const translationSearch = await db
    .collection('translation-search')
    .deleteMany(translationSearchRows, { session })
  args.payload.logger.info({
    msg: `Remove Posts and Categories execution: ${JSON.stringify({
      database: db.databaseName,
      archiveBlocks,
      searchRows: search.deletedCount,
      translationSearchRows: translationSearch.deletedCount,
      dropped,
    })}`,
  })
}

export async function down(args: MigrateDownArgs) {
  const db = migrationTarget(args, 'down')
  const changes = await planArchives(db, 'down')
  const archiveBlocks = await applyArchiveChanges(db, changes, args.session)
  args.payload.logger.info({
    msg: `Remove Posts and Categories rollback: ${JSON.stringify({ database: db.databaseName, archiveBlocks })}`,
  })
}
