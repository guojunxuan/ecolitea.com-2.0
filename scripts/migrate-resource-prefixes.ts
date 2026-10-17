/** Explicit operational migration. Importing this module never initializes Payload or storage. */
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { getFileKey } from '@payloadcms/plugin-cloud-storage/utilities'
import type { CollectionSlug, GlobalSlug, Payload } from 'payload'
import { findMediaReferences, type MediaReference } from '../src/collections/mediaReferences'

type Document = Record<string, unknown>
type Collection = 'media' | 'site-assets'
export type Stage =
  'inventory' | 'copy' | 'update' | 'verify' | 'remove-originals' | 'purge-media-versions'
export type Target = { database: string; bucket: string; endpoint: string; publicURL: string }
type ObjectInfo = { etag: string; size: number }
type File = {
  field: string
  filename: string
  sourceKey: string
  destinationKey: string
  oldURL: string
  newURL: string
  source: ObjectInfo | null
  copied?: boolean
  verified?: boolean
  removed?: boolean
}
type Item = {
  collection: Collection
  id: string
  absentFields: string[]
  before: Document
  after: Document
  files: File[]
  updated?: boolean
  missingDeleted?: boolean
}
export type Manifest = {
  version: 1
  target: Target
  createdAt: string
  digest: string
  items: Item[]
  references: MediaReference[]
  mediaVersions: Array<{ id: string; backup: Document }>
  versionsPurged?: boolean
  events: Array<{ at: string; stage: Stage; detail: string }>
}
export type MigrationServices = {
  payload: Payload
  target: Target
  /** Native Payload database adapter read, before URL afterRead hooks, for exact rollback metadata. */
  readStored?(collection: Collection, id: string): Promise<Document | null>
  storage: {
    head(key: string): Promise<ObjectInfo | null>
    copy(source: string, destination: string): Promise<void>
    remove(key: string): Promise<void>
  }
  checkURL(url: string): Promise<number>
  scanSourceURLs(urls: string[]): Promise<string[]>
  /** Explicit repair access: only the physical Media version collection, including when versions=false. */
  versions: {
    inventory(): Promise<Array<{ id: string; backup: Document }>>
    remove(ids: string[]): Promise<void>
  }
  save(manifest: Manifest): Promise<void>
}
const stages: Stage[] = [
  'inventory',
  'copy',
  'update',
  'verify',
  'remove-originals',
  'purge-media-versions',
]
const record = (value: unknown): value is Document =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const idOf = (value: Document) => {
  if ((typeof value.id !== 'string' && typeof value.id !== 'number') || !String(value.id))
    throw new Error('Incomplete inventory: missing ID.')
  return String(value.id)
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const targetFingerprint = (target: Target) => hash(target)
const inventoryDigest = (manifest: Manifest) =>
  hash({
    target: manifest.target,
    items: manifest.items.map(({ collection, id, absentFields, before, after, files }) => ({
      collection,
      id,
      absentFields,
      before,
      after,
      files: files.map(({ copied: _c, verified: _v, removed: _r, ...file }) => file),
    })),
    mediaVersions: manifest.mediaVersions,
  })
const urlFor = (target: Target, key: string) =>
  `${target.publicURL.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`

/** Fail closed on truncated pages, duplicates, concurrent count changes, or invalid metadata. */
async function allPages(fetchPage: (page: number) => Promise<unknown>): Promise<Document[]> {
  const documents: Document[] = []
  const seen = new Set<string>()
  let total: number | undefined
  for (let page = 1; ; page++) {
    const result = await fetchPage(page)
    if (
      !record(result) ||
      !Array.isArray(result.docs) ||
      typeof result.hasNextPage !== 'boolean' ||
      !Number.isInteger(result.totalDocs) ||
      Number(result.totalDocs) < 0 ||
      !Number.isInteger(result.totalPages) ||
      Number(result.totalPages) < 0 ||
      result.page !== page
    )
      throw new Error('Incomplete inventory pagination.')
    if (total !== undefined && total !== result.totalDocs)
      throw new Error('Incomplete inventory: count changed.')
    total = Number(result.totalDocs)
    for (const doc of result.docs) {
      if (!record(doc)) throw new Error('Incomplete inventory document.')
      const id = idOf(doc)
      if (seen.has(id)) throw new Error('Incomplete inventory: duplicate ID.')
      seen.add(id)
      documents.push(doc)
    }
    if (!result.hasNextPage) {
      if (documents.length !== total || page < Number(result.totalPages))
        throw new Error('Incomplete inventory: missing records.')
      return documents
    }
    if (
      !result.docs.length ||
      documents.length >= total ||
      result.nextPage !== page + 1 ||
      page >= Number(result.totalPages)
    )
      throw new Error('Incomplete inventory pagination.')
  }
}
const query = (page: number) => ({
  page,
  limit: 100,
  depth: 0,
  sort: 'id',
  overrideAccess: true,
  showHiddenFields: true,
  locale: 'all' as const,
  trash: true,
})

export async function createInventory(services: MigrationServices): Promise<Manifest> {
  const items: Item[] = []
  const sourceOwners = new Map<string, string>()
  for (const collection of ['media', 'site-assets'] as const) {
    const docs = await allPages((page) => services.payload.find({ collection, ...query(page) }))
    for (const listedDoc of docs) {
      const id = idOf(listedDoc)
      const doc = services.readStored ? await services.readStored(collection, id) : listedDoc
      if (!doc) throw new Error('Document disappeared during inventory.')
      if (typeof doc.filename !== 'string' || !doc.filename || typeof doc.url !== 'string')
        throw new Error(`Incomplete inventory: ${collection}/${id} filename or URL absent.`)
      if (doc.prefix !== undefined && doc.prefix !== null && typeof doc.prefix !== 'string')
        throw new Error('Invalid stored prefix.')
      const before: Document = { prefix: doc.prefix ?? null, url: doc.url }
      const after: Document = { prefix: collection }
      const files: File[] = []
      const addFile = async (filename: string, oldURL: string, field: string) => {
        // Inventory runs against OLD rules: empty/missing stored prefix means root.
        const sourceKey = getFileKey({
          filename,
          docPrefix: typeof doc.prefix === 'string' ? doc.prefix : '',
        }).fileKey
        const destinationKey = getFileKey({ filename, collectionPrefix: collection }).fileKey
        if (new URL(oldURL).href !== new URL(urlFor(services.target, sourceKey)).href)
          throw new Error(
            `Source URL/key mismatch for ${collection}/${id}; use old deployment for inventory.`,
          )
        const owner = `${collection}/${id}/${field}`
        if (sourceOwners.has(sourceKey) && sourceOwners.get(sourceKey) !== owner)
          throw new Error(`Shared source key ${sourceKey}; manual reconciliation required.`)
        sourceOwners.set(sourceKey, owner)
        files.push({
          field,
          filename,
          sourceKey,
          destinationKey,
          oldURL,
          newURL: urlFor(services.target, destinationKey),
          source: await services.storage.head(sourceKey),
        })
      }
      await addFile(doc.filename, doc.url, 'url')
      after.url = files[0].newURL
      if (record(doc.sizes)) {
        before.sizes = structuredClone(doc.sizes)
        after.sizes = structuredClone(doc.sizes)
        for (const [name, size] of Object.entries(doc.sizes))
          if (record(size) && typeof size.filename === 'string') {
            if (typeof size.url !== 'string') throw new Error('Incomplete size URL.')
            await addFile(size.filename, size.url, `sizes.${name}.url`)
            ;((after.sizes as Document)[name] as Document).url = files.at(-1)!.newURL
          }
      }
      items.push({
        collection,
        id,
        absentFields: ['prefix'].filter((field) => !(field in doc)),
        before,
        after,
        files,
      })
    }
  }
  const manifest: Manifest = {
    version: 1,
    target: services.target,
    createdAt: new Date().toISOString(),
    digest: '',
    items,
    references: await findMediaReferences(
      services.payload,
      items.filter((item) => item.collection === 'media').map((item) => item.id),
    ),
    mediaVersions: structuredClone(await services.versions.inventory()),
    events: [],
  }
  manifest.digest = inventoryDigest(manifest)
  await services.save(manifest)
  return manifest
}
const sameObject = (a: ObjectInfo | null, b: ObjectInfo | null) =>
  !!a && !!b && a.etag === b.etag && a.size === b.size
function metadata(doc: Document, expected: Document) {
  return Object.entries(expected).every(
    ([key, value]) => JSON.stringify(doc[key] ?? null) === JSON.stringify(value),
  )
}
async function lookup(services: MigrationServices, item: Item): Promise<Document | null> {
  try {
    const doc = services.readStored
      ? await services.readStored(item.collection, item.id)
      : await services.payload.findByID({
          collection: item.collection,
          id: item.id,
          depth: 0,
          overrideAccess: true,
          showHiddenFields: true,
          trash: true,
        })
    return record(doc) ? doc : null
  } catch (error) {
    if ((error as { status?: number }).status === 404) return null
    throw error
  }
}
async function current(services: MigrationServices, item: Item) {
  const doc = await lookup(services, item)
  if (!doc) throw new Error('Document missing; reconcile manually.')
  return doc
}

export async function runMigrationStage(
  stage: Stage,
  manifest: Manifest,
  services: MigrationServices,
  options: { execute?: boolean; confirm?: string; deleteMissingMedia?: string[] } = {},
): Promise<Manifest> {
  if (
    manifest.version !== 1 ||
    manifest.digest !== inventoryDigest(manifest) ||
    targetFingerprint(manifest.target) !== targetFingerprint(services.target)
  )
    throw new Error('Manifest inventory or target mismatch.')
  if (!stages.includes(stage) || stage === 'inventory')
    throw new Error('Create a new inventory explicitly.')
  if (!options.execute) return manifest
  if (
    (stage === 'remove-originals' || stage === 'purge-media-versions') &&
    options.confirm !== stage
  )
    throw new Error(`Separate confirmation required: ${stage}.`)
  const checkpoint = async (detail: string) => {
    manifest.events.push({ stage, at: new Date().toISOString(), detail })
    await services.save(manifest)
  }
  if (stage === 'purge-media-versions') {
    const live = await services.versions.inventory()
    const expected = new Set(manifest.mediaVersions.map((version) => version.id))
    if (
      live.some(
        (version) =>
          !expected.has(version.id) ||
          JSON.stringify(version.backup) !==
            JSON.stringify(manifest.mediaVersions.find((v) => v.id === version.id)!.backup),
      )
    )
      throw new Error('Media versions changed since inventory.')
    await checkpoint(
      `Approved Media version repair: ${live.length} remaining versions; full backups in manifest.`,
    )
    if (live.length) await services.versions.remove(live.map((version) => version.id))
    if ((await services.versions.inventory()).length)
      throw new Error('Media version purge incomplete.')
    manifest.versionsPurged = true
    await checkpoint('Media versions purged.')
    return manifest
  }
  const missingIDs = options.deleteMissingMedia ?? []
  if (missingIDs.length && stage !== 'remove-originals')
    throw new Error('Missing Media deletion only allowed in remove-originals.')
  // Inspect all records BEFORE any removal. A stale manifest never authorizes deletion.
  if (stage === 'remove-originals') {
    const missing = manifest.items.filter(
      (item) => missingIDs.includes(item.id) && item.collection === 'media',
    )
    if (
      missing.length !== missingIDs.length ||
      missing.some((item) => item.files.some((file) => file.source !== null))
    )
      throw new Error('Only inventoried missing Media originals can be deleted.')
    const refs = await findMediaReferences(services.payload, missingIDs)
    manifest.references = await findMediaReferences(
      services.payload,
      manifest.items.filter((item) => item.collection === 'media').map((item) => item.id),
    )
    await checkpoint('Fresh reference scan completed.')
    if (refs.some((ref) => ref.kind === 'current'))
      throw new Error('Missing Media is currently referenced; deletion refused.')
    for (const item of manifest.items) {
      if (missing.includes(item)) continue
      if (
        item.files.some((file) => !file.source || !file.copied || !file.verified) ||
        !item.updated
      )
        throw new Error(
          'Every retained record must be copied, updated and verified before deletion.',
        )
      if (!metadata(await current(services, item), item.after))
        throw new Error('Document changed after verification.')
      for (const file of item.files) {
        if (
          !sameObject(file.source, await services.storage.head(file.destinationKey)) ||
          (await services.checkURL(file.newURL)) !== 200
        )
          throw new Error('Destination no longer verified with HTTP 200.')
        const source = await services.storage.head(file.sourceKey)
        if (file.sourceKey !== file.destinationKey && source && !sameObject(source, file.source))
          throw new Error('Source object changed; deletion refused.')
      }
    }
    const urls = manifest.items.flatMap((item) =>
      item.files
        .filter((file) => file.sourceKey !== file.destinationKey)
        .flatMap((file) => [
          file.oldURL,
          new URL(file.oldURL).href,
          decodeURI(new URL(file.oldURL).href),
        ]),
    )
    const hardcodes = [
      ...(await services.scanSourceURLs(urls)),
      ...(await scanPersistedURLs(services, urls)),
    ]
    if (hardcodes.length) {
      await checkpoint(`Hardcoded source URL references: ${JSON.stringify(hardcodes)}`)
      throw new Error('Hardcoded source URLs remain; deletion refused.')
    }
    for (const item of missing) {
      if (item.missingDeleted) continue
      for (const file of item.files)
        if (
          (await services.storage.head(file.sourceKey)) ||
          (await services.storage.head(file.destinationKey))
        )
          throw new Error('A missing Media source or destination now exists; reinventory required.')
      const doc = await lookup(services, item)
      if (!doc) {
        item.missingDeleted = true
        await checkpoint(`Missing Media ${item.id} already deleted; recovered checkpoint.`)
        continue
      }
      if (!metadata(doc, item.before)) throw new Error('Missing Media changed since inventory.')
      await checkpoint(
        `Deleting missing Media ${item.id}; references=${JSON.stringify(refs.filter((ref) => ref.mediaID === item.id))}`,
      )
      await services.payload.delete({
        collection: 'media',
        id: item.id,
        overrideAccess: true,
        context: { disableRevalidate: true },
      })
      item.missingDeleted = true
      await checkpoint(`Deleted missing Media ${item.id}.`)
    }
    for (const item of manifest.items.filter((item) => !missing.includes(item)))
      for (const file of item.files) {
        if (file.sourceKey === file.destinationKey || file.removed) continue
        await services.storage.remove(file.sourceKey)
        file.removed = true
        await checkpoint(`Removed original ${file.sourceKey}.`)
      }
    return manifest
  }
  for (const item of manifest.items) {
    if (item.files.some((file) => !file.source)) {
      await checkpoint(
        `Skipped missing source for ${item.collection}/${item.id}; retained for explicit reconciliation.`,
      )
      continue
    }
    if (stage === 'copy')
      for (const file of item.files) {
        const destination = await services.storage.head(file.destinationKey)
        if (destination && !sameObject(file.source, destination))
          throw new Error('Destination collision; refusing overwrite.')
        if (!destination) {
          if (!sameObject(file.source, await services.storage.head(file.sourceKey)))
            throw new Error('Source changed since inventory.')
          await services.storage.copy(file.sourceKey, file.destinationKey)
        }
        if (!sameObject(file.source, await services.storage.head(file.destinationKey)))
          throw new Error('Copy did not preserve size/ETag.')
        file.copied = true
        await checkpoint(`Copied ${file.sourceKey} -> ${file.destinationKey}.`)
      }
    if (stage === 'update') {
      if (item.files.some((file) => !file.copied))
        throw new Error('All objects must be copied before update.')
      for (const file of item.files)
        if (!sameObject(file.source, await services.storage.head(file.destinationKey)))
          throw new Error('Copied destination changed.')
      const doc = await current(services, item)
      if (!metadata(doc, item.after)) {
        if (!metadata(doc, item.before))
          throw new Error('Document changed since inventory; refusing update.')
        await checkpoint(`Updating ${item.collection}/${item.id}; rollback fields in before.`)
        await services.payload.update({
          collection: item.collection,
          id: item.id,
          data: item.after,
          overrideAccess: true,
          context: { disableRevalidate: true, skipCloudStorage: true },
        })
      }
      if (!metadata(await current(services, item), item.after))
        throw new Error(
          'Payload did not persist planned metadata; review legacy schema before proceeding.',
        )
      item.updated = true
      await checkpoint(`Updated ${item.collection}/${item.id}.`)
    }
    if (stage === 'verify') {
      if (!item.updated || !metadata(await current(services, item), item.after))
        throw new Error('Document must be updated before verification.')
      for (const file of item.files) {
        file.verified = false
        await services.save(manifest)
        if (
          !sameObject(file.source, await services.storage.head(file.destinationKey)) ||
          (await services.checkURL(file.newURL)) !== 200
        )
          throw new Error(`New URL must return HTTP 200: ${file.newURL}`)
        file.verified = true
        await checkpoint(`Verified HTTP 200 ${file.newURL}.`)
      }
    }
  }
  return manifest
}

async function scanPersistedURLs(services: MigrationServices, urls: string[]): Promise<string[]> {
  const matches: string[] = []
  const inspect = (doc: unknown, owner: string) => {
    if (urls.some((url) => JSON.stringify(doc).includes(url))) matches.push(owner)
  }
  for (const collection of services.payload.config.collections) {
    if (collection.slug === 'payload-locked-documents') continue
    for (const doc of await allPages((page) =>
      services.payload.find({ collection: collection.slug as CollectionSlug, ...query(page) }),
    )) {
      const content = structuredClone(doc)
      // Upload metadata is already checked separately, and is not a hardcoded content URL.
      if (collection.slug === 'media' || collection.slug === 'site-assets') {
        delete content.url
        if (record(content.sizes))
          for (const size of Object.values(content.sizes)) if (record(size)) delete size.url
      }
      inspect(content, `${collection.slug}/${idOf(doc)}`)
    }
    if (collection.versions)
      for (const version of await allPages((page) =>
        services.payload.findVersions({
          collection: collection.slug as CollectionSlug,
          ...query(page),
        }),
      ))
        inspect(version, `${collection.slug} version/${idOf(version)}`)
  }
  for (const global of services.payload.config.globals) {
    inspect(
      await services.payload.findGlobal({
        slug: global.slug as GlobalSlug,
        depth: 0,
        overrideAccess: true,
        locale: 'all',
        showHiddenFields: true,
      }),
      `global/${global.slug}`,
    )
    if (global.versions)
      for (const version of await allPages((page) =>
        services.payload.findGlobalVersions({ slug: global.slug as GlobalSlug, ...query(page) }),
      ))
        inspect(version, `global/${global.slug} version/${idOf(version)}`)
  }
  for (const version of await services.versions.inventory())
    inspect(version.backup, `media version/${version.id}`)
  return matches
}

export function parseArguments(argv: string[]) {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  for (const arg of argv) {
    if (arg === '--') continue
    if (['--execute', '--maintenance-window', '--environment'].includes(arg)) {
      if (flags.has(arg)) throw new Error(`Duplicate ${arg}`)
      flags.add(arg)
      continue
    }
    const match =
      /^--(stage|report|expected-target|expected-inventory|confirm|delete-missing-media)=(.+)$/.exec(
        arg,
      )
    if (!match || values.has(match[1])) throw new Error(`Unknown or duplicate argument: ${arg}`)
    values.set(match[1], match[2])
  }
  const stage = values.get('stage') ?? 'inventory'
  if (!stages.includes(stage as Stage)) throw new Error(`Unknown stage: ${stage}`)
  const execute = flags.has('--execute')
  const confirm = values.get('confirm')
  if (execute && ['remove-originals', 'purge-media-versions'].includes(stage) && confirm !== stage)
    throw new Error('Separate destructive-stage confirmation required.')
  if (execute && !flags.has('--maintenance-window'))
    throw new Error('Writes require --maintenance-window (all application writers stopped).')
  if (!flags.has('--environment') && !values.has('report'))
    throw new Error('--report=<manifest.json> is required.')
  return {
    stage: stage as Stage,
    execute,
    confirm,
    report: values.get('report'),
    expectedTarget: values.get('expected-target'),
    expectedInventory: values.get('expected-inventory'),
    environment: flags.has('--environment'),
    deleteMissingMedia: values.get('delete-missing-media')?.split(','),
  }
}

/** Reuses the SDK already owned by the installed S3 adapter; adds no project dependency. */
export async function createInstalledS3Storage(env: NodeJS.ProcessEnv) {
  const requireFromAdapter = createRequire(import.meta.resolve('@payloadcms/storage-s3'))
  const { S3 } = await import(pathToFileURL(requireFromAdapter.resolve('@aws-sdk/client-s3')).href)
  const client = new S3({
    endpoint: env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    region: 'auto',
    maxAttempts: 1,
  })
  const Bucket = env.R2_BUCKET
  return {
    head: async (Key: string): Promise<ObjectInfo | null> => {
      try {
        const object = await client.headObject({ Bucket, Key })
        if (!object.ETag || !Number.isFinite(object.ContentLength))
          throw new Error('Incomplete object metadata.')
        return { etag: object.ETag, size: object.ContentLength }
      } catch (error) {
        if (
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        )
          return null
        throw error
      }
    },
    copy: async (source: string, Key: string) => {
      await client.copyObject({
        Bucket,
        Key,
        CopySource: `${Bucket}/${source.split('/').map(encodeURIComponent).join('/')}`,
        CopySourceIfMatch: (await client.headObject({ Bucket, Key: source })).ETag,
        MetadataDirective: 'COPY',
      })
    },
    remove: async (Key: string) => {
      await client.deleteObject({ Bucket, Key })
    },
    close: () => client.destroy(),
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  // Load configuration only when invoked, never when test helpers are imported.
  await import('dotenv/config')
  const { serverEnv } = await import('../src/utilities/env')
  const databaseURL = new URL(serverEnv.DATABASE_URI)
  const target: Target = {
    database: `${databaseURL.protocol}//${databaseURL.host}${databaseURL.pathname}`,
    bucket: serverEnv.R2_BUCKET,
    endpoint: new URL(serverEnv.R2_ENDPOINT).origin,
    publicURL: serverEnv.R2_PUBLIC_URL,
  }
  const fingerprint = targetFingerprint(target)
  process.stderr.write(
    `Resource migration environment (no connection yet): ${JSON.stringify(target)}; target fingerprint=${fingerprint}\n`,
  )
  if (options.environment) return
  if (options.expectedTarget !== fingerprint)
    throw new Error(
      'Review environment report first, then supply its --expected-target=<fingerprint>.',
    )
  if (process.env.DISABLE_R2_STORAGE === 'true')
    throw new Error(
      'Operational CLI requires the reported R2 environment; use injected services for local tests.',
    )
  if (process.env.PAYLOAD_DROP_DATABASE === 'true')
    throw new Error('PAYLOAD_DROP_DATABASE is forbidden for this migration.')
  const reportPath = options.report!
  const previous =
    options.stage === 'inventory'
      ? undefined
      : (JSON.parse(await readFile(reportPath, 'utf8')) as Manifest)
  if (options.execute && previous && options.expectedInventory !== previous.digest)
    throw new Error('Writes require --expected-inventory=<approved inventory digest>.')
  if (!previous) {
    try {
      await readFile(reportPath)
      throw new Error('Inventory report already exists; choose a new path.')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  // Only this maintenance process uses legacy fallback. New application deployment keeps
  // collection prefixes. Mutate the public plugin options before buildConfig applies them.
  const { r2StorageCollections } = await import('../src/plugins')
  for (const collection of ['media', 'site-assets'] as const) {
    r2StorageCollections[collection].prefix = ''
    r2StorageCollections[collection].generateFileURL = ({ filename, prefix }) =>
      urlFor(target, getFileKey({ filename, docPrefix: prefix }).fileKey)
  }
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const resolvedConfig = await config
  const initializeDatabase = resolvedConfig.db.init
  resolvedConfig.db = {
    ...resolvedConfig.db,
    init: (args) => {
      const adapter = initializeDatabase(args) as Payload['db']
      if (adapter.name !== 'mongoose')
        throw new Error('Migration requires the reviewed MongoDB adapter.')
      // Inventory must not create collections, indexes, or run production migrations.
      adapter.ensureIndexes = false
      adapter.prodMigrations = undefined
      adapter.connectOptions = { ...adapter.connectOptions, autoCreate: false, autoIndex: false }
      for (const collection of resolvedConfig.collections) {
        adapter.collectionsSchemaOptions ??= {}
        adapter.collectionsSchemaOptions[collection.slug] = {
          ...adapter.collectionsSchemaOptions[collection.slug],
          autoCreate: false,
          autoIndex: false,
        }
      }
      return adapter
    },
  }
  const payload = await getPayload({ config: resolvedConfig })
  const storage = await createInstalledS3Storage(process.env)
  try {
    const mongo = payload.db.connection
    const mediaConfig = payload.config.collections.find((collection) => collection.slug === 'media')
    if (!mediaConfig || mediaConfig.dbName)
      throw new Error('Review physical Media versions collection for this adapter configuration.')
    // Explicit Mongo operational repair: Media versions are disabled and have no Payload model.
    const versionCollection = payload.db.autoPluralization
      ? (mongo.base.pluralize()?.('_media_versions') ?? '_media_versions')
      : '_media_versions'
    if (versionCollection !== '_media_versions')
      throw new Error('Unexpected Media versions collection; repair requires review.')
    const versions = mongo.collection(versionCollection)
    const EJSON = mongo.base.mongo.BSON.EJSON
    const services: MigrationServices = {
      payload,
      target,
      storage,
      readStored: async (collection, id) =>
        (await payload.db.findOne({
          collection,
          where: { id: { equals: id } },
        })) as unknown as Document | null,
      checkURL: async (url) => {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(30_000),
        })
        await response.body?.cancel()
        return response.status
      },
      scanSourceURLs: async (urls) => {
        if (!urls.length) return []
        try {
          const { stdout } = await promisify(execFile)(
            'rg',
            [
              '--line-number',
              '--fixed-strings',
              '--hidden',
              '--no-ignore',
              '--glob',
              '!.git/**',
              '--glob',
              '!node_modules/**',
              '--glob',
              '!.next*/**',
              '--glob',
              '!.env*',
              '--glob',
              '!*.tsbuildinfo',
              ...urls.flatMap((url) => ['-e', url]),
              'src',
              'public',
              'docs',
              'scripts',
              'README.md',
            ],
            { maxBuffer: 20 * 1024 * 1024 },
          )
          return stdout.trim().split('\n').filter(Boolean)
        } catch (error) {
          if ((error as { code?: number }).code === 1) return []
          throw error
        }
      },
      versions: {
        inventory: async () =>
          (await versions.find({}).sort({ _id: 1 }).toArray()).map((doc) => ({
            id: String(doc._id),
            backup: EJSON.serialize(doc) as Document,
          })),
        remove: async (ids) => {
          await versions.deleteMany({
            _id: { $in: ids.map((id) => new mongo.base.Types.ObjectId(id)) },
          })
        },
      },
      save: async (manifest) => {
        const temporary = `${reportPath}.tmp`
        await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
        await rename(temporary, reportPath)
      },
    }
    const manifest = previous ?? (await createInventory(services))
    if (previous) await runMigrationStage(options.stage, manifest, services, options)
    process.stdout.write(
      `${JSON.stringify({ stage: options.stage, mode: options.execute ? 'execute' : 'dry-run', report: reportPath, records: manifest.items.length, inventoryDigest: manifest.digest, missingOriginals: manifest.items.filter((item) => !item.files[0].source).map((item) => `${item.collection}/${item.id}`), historicalReferences: manifest.references.filter((ref) => ref.kind === 'version').length, mediaVersions: manifest.mediaVersions.length }, null, 2)}\n`,
    )
  } finally {
    storage.close()
    await payload.destroy()
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
