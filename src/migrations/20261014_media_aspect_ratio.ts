import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

type LegacyMediaBlock = { blockType?: unknown; width?: unknown; aspectRatio?: unknown }
type BulkOperation = Parameters<
  ReturnType<NonNullable<MongooseAdapter['connection']['db']>['collection']>['bulkWrite']
>[0][number]

function migrateValue(value: unknown, direction: 'up' | 'down'): boolean {
  if (!value || typeof value !== 'object') return false
  let changed = false
  if (Array.isArray(value)) {
    for (const child of value) changed = migrateValue(child, direction) || changed
    return changed
  }
  const record = value as Record<string, unknown>
  if (record.blockType === 'mediaBlock' && typeof record.width === 'string') {
    const block = record as LegacyMediaBlock
    if (direction === 'up') {
      block.aspectRatio = 'original'
      changed = true
    } else if (direction === 'down' && block.aspectRatio === 'original') {
      delete block.aspectRatio
      changed = true
    }
  }
  for (const child of Object.values(record)) changed = migrateValue(child, direction) || changed
  return changed
}

async function migrateMediaRatios(
  { payload }: MigrateUpArgs | MigrateDownArgs,
  direction: 'up' | 'down',
): Promise<void> {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) throw new Error('Media aspect ratio migration requires an open MongoDB connection.')

  payload.logger.info({
    msg: `Media aspect ratio migration (${direction}) target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}`,
  })

  for (const slug of ['blogs', 'pages', 'posts']) {
    const collection = db.collection(slug)
    const operations: BulkOperation[] = []
    let migrated = 0
    for await (const document of collection.find({})) {
      if (!migrateValue(document, direction)) continue
      const { _id, ...fields } = document
      operations.push({ updateOne: { filter: { _id }, update: { $set: fields } } })
      migrated += 1
      if (operations.length === 250) {
        await collection.bulkWrite(operations)
        operations.length = 0
      }
    }
    if (operations.length) await collection.bulkWrite(operations)
    payload.logger.info({
      msg: `Media aspect ratio migration (${direction}): ${slug}, ${migrated} documents updated.`,
    })
  }
}

export async function up(args: MigrateUpArgs): Promise<void> {
  await migrateMediaRatios(args, 'up')
}

export async function down(args: MigrateDownArgs): Promise<void> {
  await migrateMediaRatios(args, 'down')
}
