import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import { scanRemovePostsCategories } from '../src/migrations/20261120_remove_posts_categories'

const localDatabaseURI = 'mongodb://127.0.0.1:27017/ecolitea2'

async function main() {
  const uri = process.env.DATABASE_URI
  if (uri !== localDatabaseURI) {
    process.stderr.write(`An explicit local DATABASE_URI=${localDatabaseURI} is required.\n`)
    process.exitCode = 1
    return
  }

  process.stderr.write(`Remove Posts and Categories preflight target: ${uri}; storage disabled\n`)

  // Use the installed adapter's MongoDB driver directly. Loading Payload or Mongoose
  // models could initialize indexes or collections, run hooks, or contact other services.
  type MongoClient = ReturnType<MongooseAdapter['connection']['getClient']>
  const requireFromAdapter = createRequire(import.meta.resolve('@payloadcms/db-mongodb'))
  const { MongoClient } = requireFromAdapter('mongodb') as {
    MongoClient: new (
      url: string,
      options: { directConnection: boolean; serverSelectionTimeoutMS: number },
    ) => MongoClient
  }
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 3000 })
  try {
    const { report } = await scanRemovePostsCategories(client.db())
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    if (report.blockerCount) process.exitCode = 1
  } finally {
    await client.close()
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
