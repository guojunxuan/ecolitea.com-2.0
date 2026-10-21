import { pathToFileURL } from 'node:url'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import {
  scanBlockSlugMigration,
  type Direction,
} from '../src/migrations/20261021_collection_owned_block_slugs'

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
  if (uri !== 'mongodb://127.0.0.1:27017/ecolitea2')
    throw new Error(
      'An explicit local DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2 is required; production and remote targets are forbidden.',
    )
  return { host: '127.0.0.1', port: 27017, databaseName: 'ecolitea2' }
}

export async function buildBlockSlugReport(adapter: MongooseAdapter, direction: Direction = 'up') {
  const { writes: _writes, ...report } = await scanBlockSlugMigration(adapter, direction)
  return report
}

async function main() {
  const direction = parseReportArguments(process.argv.slice(2))
  const target = assertLocalDatabaseURI(process.env.DATABASE_URI)
  // Match Payload CLI environment loading without allowing .env to supply or
  // override the explicit database target required above. dotenv never overrides
  // existing variables by default, and remains outside import-time helpers.
  await import('dotenv/config')
  process.stderr.write(
    `Block slug dry-run target: ${target.host}:${target.port}/${target.databaseName}; storage: unchanged (${process.env.DISABLE_R2_STORAGE === 'true' ? 'local; R2 disabled' : 'configured storage is not accessed'})\n`,
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
    const report = await buildBlockSlugReport(adapter, direction)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (
      report.unknown.length ||
      report.headerVersions.adapterModel ||
      report.headerVersions.collectionsWithDocuments.length
    )
      process.exitCode = 1
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
