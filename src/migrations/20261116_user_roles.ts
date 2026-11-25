import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

function target(payload: MigrateUpArgs['payload']) {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) throw new Error('User roles migration requires an open MongoDB connection.')
  payload.logger.info(
    `User roles migration target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}; storage: untouched`,
  )
  return db.collection('users')
}

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Existing accounts predate roles and keep full access; users that already have a role
  // (created after the deploy, or on a re-run) are left unchanged.
  await target(payload).updateMany({ role: { $exists: false } }, { $set: { role: 'admin' } })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await target(payload).updateMany({}, { $unset: { role: '' } })
}
