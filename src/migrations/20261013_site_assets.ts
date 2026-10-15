import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

/** Collection renames cannot run in a MongoDB transaction. Run while application writes are paused. */
const renameAssets = async ({ payload }: MigrateUpArgs, source: string, destination: string) => {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) throw new Error('Site Assets migration requires an open MongoDB connection.')

  payload.logger.info({ msg: `Site Assets migration target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}; storage: unchanged (no file operations)` })
  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  if (collections.some(({ name }) => name === destination)) {
    throw new Error(`Destination collection ${destination} already exists. Refusing to merge assets.`)
  }
  if (!collections.some(({ name }) => name === source)) {
    payload.logger.info({ msg: `Source collection ${source} does not exist; no assets to rename.` })
    return
  }
  const legacyExists = collections.some(({ name }) => name === '_brand-assets_versions')
  const legacyCount = legacyExists ? await db.collection('_brand-assets_versions').countDocuments() : 0
  payload.logger.info({ msg: `_brand-assets_versions: ${legacyCount} legacy records; left untouched.` })

  // All three operations intentionally run outside the migration transaction: rename is not transactional.
  await db.collection(source).rename(destination, { dropTarget: false })
  await db.collection('payload-locked-documents').updateMany(
    { 'document.relationTo': source },
    { $set: { 'document.relationTo': destination } },
  )
  await db.collection('payload-preferences').updateMany(
    { key: { $regex: source } },
    [{ $set: { key: { $replaceAll: { input: '$key', find: source, replacement: destination } } } }],
  )
}

export async function up(args: MigrateUpArgs): Promise<void> {
  await renameAssets(args, 'brand-assets', 'site-assets')
}

export async function down(args: MigrateDownArgs): Promise<void> {
  await renameAssets(args, 'site-assets', 'brand-assets')
}
