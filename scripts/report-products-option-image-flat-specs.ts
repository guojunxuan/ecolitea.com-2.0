import { pathToFileURL } from 'node:url'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { scanProductOptionImageMigration } from '../src/migrations/20261026_products_option_image_flat_specs'

type Direction = 'up' | 'down'

export function parseReportArguments(argv: string[]): Direction {
  let direction: Direction | undefined
  for (const [i, argument] of argv.entries()) {
    if (argument === '--' && i === 0) continue
    if (direction || (argument !== '--direction=up' && argument !== '--direction=down'))
      throw new Error(`Unknown or duplicate argument: ${argument}`)
    direction = argument === '--direction=down' ? 'down' : 'up'
  }
  return direction ?? 'up'
}

export function assertLocalDatabaseURI(uri: string | undefined) {
  // Exact allowlist also excludes credentials, multi-host URIs and query options that
  // could redirect a nominally local URI to a replica-set member elsewhere.
  if (process.env.NODE_ENV === 'production' || uri !== 'mongodb://127.0.0.1:27017/ecolitea2')
    throw new Error(
      'An explicit local DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2 is required; production and remote targets are forbidden.',
    )
  return { host: '127.0.0.1', port: 27017, databaseName: 'ecolitea2' }
}

export async function buildProductOptionImageReport(
  adapter: MongooseAdapter,
  direction: Direction = 'up',
) {
  const { writes: _writes, ...report } = await scanProductOptionImageMigration(
    adapter,
    direction,
    {},
    process.env.PRODUCT_OPTION_IMAGE_DEMO_REPAIR === 'true',
  )
  return report
}

async function main() {
  const direction = parseReportArguments(process.argv.slice(2))
  const target = assertLocalDatabaseURI(process.env.DATABASE_URI)
  // Match Payload CLI environment loading without allowing .env to supply or
  // override the explicit database target required above. dotenv never overrides
  // existing variables by default, and remains outside import-time helpers.
  await import('dotenv/config')
  // Re-check runtime mode after dotenv too, before initializing or connecting.
  assertLocalDatabaseURI(process.env.DATABASE_URI)
  const configuredStorage = {
    type: process.env.DISABLE_R2_STORAGE === 'true' ? 'local' : 'R2',
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).hostname : undefined,
    publicHost: process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : undefined,
  }
  process.stderr.write(
    `Product option image dry-run target: ${target.host}:${target.port}/${target.databaseName}; configured storage: ${JSON.stringify(configuredStorage)}; execution: R2 disabled, storage not accessed\n`,
  )
  // Do not let storage plugins initialize remote services, generate local artifacts,
  // run onInit hooks, create collections/indexes or execute adapter connect hooks.
  process.env.DISABLE_R2_STORAGE = 'true'
  // Standalone CLI must not subscribe to Next development HMR WebSockets.
  process.env.DISABLE_PAYLOAD_HMR = 'true'
  const [{ getPayload }, { default: configPromise }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const config = await configPromise
  config.typescript.autoGenerate = false
  // Installed Payload checks config.telemetry, not an environment flag.
  // Disable the fire-and-forget network request so this read-only CLI exits cleanly.
  config.telemetry = false
  // stdout is the machine-readable JSON report; route Payload diagnostics to stderr.
  config.logger = { options: {}, destination: process.stderr }
  const originalInit = config.db.init
  config.db.init = (args) => {
    const adapter = originalInit(args) as MongooseAdapter
    const originalAfterCreate = adapter.afterCreateConnection
    adapter.afterCreateConnection = async (instance) => {
      await originalAfterCreate?.(instance)
      instance.connection.set('autoCreate', false)
      instance.connection.set('autoIndex', false)
      instance.collectionsSchemaOptions = Object.fromEntries(
        config.collections.map(({ slug }) => [slug, { autoCreate: false, autoIndex: false }]),
      )
    }
    return adapter
  }
  const payload = await getPayload({ config, disableDBConnect: true, disableOnInit: true })
  try {
    const adapter = payload.db as MongooseAdapter
    await adapter.connection.openUri(process.env.DATABASE_URI!, {
      autoCreate: false,
      autoIndex: false,
    })
    const actual = {
      host: adapter.connection.host,
      port: adapter.connection.port,
      databaseName: adapter.connection.db?.databaseName,
    }
    if (
      actual.host !== target.host ||
      actual.port !== target.port ||
      actual.databaseName !== target.databaseName
    )
      throw new Error('Connected database does not match the explicit local target')
    const report = await buildProductOptionImageReport(adapter, direction)
    if (process.env.PRODUCT_OPTION_IMAGE_BACKUP_PATH) {
      const { createRequire } = await import('node:module')
      const require = createRequire(import.meta.url)
      const adapterRequire = createRequire(require.resolve('@payloadcms/db-mongodb'))
      const { BSON } = adapterRequire('mongodb') as {
        BSON: { EJSON: { stringify: (value: unknown) => string } }
      }
      const backup: Record<string, unknown[]> = {}
      for (const name of ['products', '_products_versions'])
        backup[name] = await adapter.connection.db!.collection(name).find({}).toArray()
      const { writeFile } = await import('node:fs/promises')
      await writeFile(process.env.PRODUCT_OPTION_IMAGE_BACKUP_PATH, BSON.EJSON.stringify(backup), {
        flag: 'wx',
        mode: 0o600,
      })
    }
    const migrations = await adapter.connection
      .db!.collection('payload-migrations')
      .find({}, { projection: { name: 1, batch: 1 } })
      .toArray()
    process.stdout.write(
      `${JSON.stringify({ ...report, migrations, configuredStorage, execution: { r2Disabled: true, storageAccessed: false, readOnly: true } }, null, 2)}\n`,
    )
    if (!report.allowedToWrite) process.exitCode = 1
  } finally {
    await payload.destroy()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main().catch((error: unknown) => {
    // Driver connection errors may contain a URI. Keep credentials out of CLI output.
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `${message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[redacted MongoDB URI]')}\n`,
    )
    process.exitCode = 1
  })
}
