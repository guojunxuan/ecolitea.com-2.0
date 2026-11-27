import { pathToFileURL } from 'node:url'
import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

import { down, scanResourcesRename, up } from '../src/migrations/20261110_product_resources_rename'
import { assertLocalDatabaseURI } from './report-product-detail-specs'

const migrationName = '20261110_product_resources_rename'

/**
 * Read-only report by default; `--apply` runs only this migration through Payload's adapter
 * and records it in the migration ledger, without replaying other pending migrations.
 */
async function main() {
  const args = process.argv.slice(2).filter((argument) => argument !== '--')
  if (args.some((argument) => argument !== '--apply'))
    throw new Error(`Unknown argument: ${args.join(' ')}`)
  const apply = args.includes('--apply')
  const target = assertLocalDatabaseURI(process.env.DATABASE_URI)
  await import('dotenv/config')
  assertLocalDatabaseURI(process.env.DATABASE_URI)
  process.stderr.write(
    `Product resources rename ${apply ? 'apply' : 'dry-run'} target: ${target.host}:${target.port}/${target.databaseName}; storage not accessed\n`,
  )
  process.env.DISABLE_R2_STORAGE = 'true'
  process.env.DISABLE_PAYLOAD_HMR = 'true'
  const [{ getPayload }, { default: configPromise }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const config = await configPromise
  config.typescript.autoGenerate = false
  config.telemetry = false
  config.logger = { options: {}, destination: process.stderr }
  const payload = await getPayload({ config, disableOnInit: true })
  try {
    const adapter = payload.db as MongooseAdapter
    const { writes: _writes, ...before } = await scanResourcesRename(adapter, 'up')
    let after: typeof before | undefined
    if (apply) {
      if (!before.allowedToWrite) throw new Error('Blocking data found; nothing was written')
      await adapter.migrate({
        migrations: [
          {
            name: migrationName,
            up: (migrateArgs) => up(migrateArgs as MigrateUpArgs),
            down: (migrateArgs) => down(migrateArgs as MigrateDownArgs),
          },
        ],
      })
      const { writes: _remaining, ...rescan } = await scanResourcesRename(adapter, 'up')
      after = rescan
      if (!rescan.allowedToWrite || rescan.toRename)
        throw new Error('The post-migration scan found remaining renames or blocking data')
    }
    const ledger = await adapter.connection
      .db!.collection('payload-migrations')
      .find({ name: migrationName }, { projection: { _id: 0, name: 1, batch: 1 } })
      .toArray()
    if (apply && !ledger.length) throw new Error('The migration ledger has no entry for this run')
    process.stdout.write(`${JSON.stringify({ before, after, ledger }, null, 2)}\n`)
    if (!before.allowedToWrite) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `${message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted MongoDB URI]')}\n`,
    )
    process.exitCode = 1
  })
}
