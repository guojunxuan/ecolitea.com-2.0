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
  await target(payload).updateMany({}, { $set: { role: 'admin' } })
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await target(payload).updateMany({}, { $unset: { role: '' } })
}
