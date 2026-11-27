import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'

import { createIsolatedTestDatabaseURI } from '../isolatedDatabase'

const databaseURI = process.env.DATABASE_URI
if (!databaseURI) throw new Error('Site Assets CLI tests require an isolated database URI.')

const databaseName = new URL(databaseURI).pathname.slice(1)
if (!/^ecolitea2-test-site-assets-[a-f0-9-]+$/.test(databaseName)) {
  throw new Error('Site Assets CLI tests require their dedicated random database.')
}

export default buildConfig({
  collections: [],
  db: mongooseAdapter({
    url: createIsolatedTestDatabaseURI(databaseName, databaseURI),
    connectOptions: { serverSelectionTimeoutMS: 3000 },
    migrationDir: fileURLToPath(new URL('./migrations', import.meta.url)),
  }),
  secret: 'isolated-site-assets-migration-test-secret',
  typescript: { autoGenerate: false },
})
