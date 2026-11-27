import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import type { Payload } from 'payload'
import { isLocaleSegment } from '../src/i18n/config'

export type ReservedSlugConflict = {
  collection: 'pages'
  id: string
  slug: string
  status: string
}

export function describeDatabaseTarget(uri: string): { database: string; label: string } {
  const target = new URL(uri)
  if (!['mongodb:', 'mongodb+srv:'].includes(target.protocol)) {
    throw new Error('DATABASE_URI must be a MongoDB URL.')
  }
  const database = decodeURIComponent(target.pathname.slice(1))
  if (!database || database.includes('/')) throw new Error('An explicit database name is required.')
  return { database, label: `${target.host}/${database}` }
}

export function parseScanArguments(argv: string[], database: string): { confirm: true } {
  if (database === 'ecolitea2') {
    throw new Error('Refusing to scan the developer database ecolitea2.')
  }
  let confirm = false
  let confirmedDatabase: string | undefined
  for (const [index, arg] of argv.entries()) {
    if (arg === '--' && index === 0) continue
    if (arg === '--confirm' && !confirm) {
      confirm = true
    } else if (arg.startsWith('--confirm-non-test=') && confirmedDatabase === undefined) {
      confirmedDatabase = arg.slice('--confirm-non-test='.length)
    } else {
      throw new Error(`Unknown or duplicate argument: ${arg}`)
    }
  }
  if (!confirm)
    throw new Error('Read-only scan requires --confirm after reviewing the target database.')
  if (!/(?:^|[-_])(?:test|int|e2e|ci)(?:$|[-_])/.test(database) && confirmedDatabase !== database) {
    throw new Error(`Non-test database requires --confirm-non-test=${database}.`)
  }
  return { confirm: true }
}

export async function scanReservedSlugs(
  payload: Pick<Payload, 'find'>,
): Promise<ReservedSlugConflict[]> {
  const conflicts = new Map<string, ReservedSlugConflict>()
  // Inspect both public and latest draft versions: a safe draft must not hide a
  // conflicting published URL. Historical versions do not own current URLs.
  for (const draft of [false, true]) {
    let page = 1
    while (true) {
      const result = await payload.find({
        collection: 'pages',
        depth: 0,
        draft,
        limit: 100,
        overrideAccess: true,
        page,
        select: { slug: true, _status: true },
        sort: 'id',
      })
      for (const doc of result.docs) {
        if (typeof doc.slug !== 'string' || !isLocaleSegment(doc.slug)) continue
        const conflict: ReservedSlugConflict = {
          collection: 'pages',
          id: String(doc.id),
          slug: doc.slug,
          status: doc._status ?? 'unknown',
        }
        conflicts.set(`${conflict.id}:${conflict.slug}:${conflict.status}`, conflict)
      }
      if (!result.hasNextPage) break
      if (typeof result.nextPage !== 'number' || result.nextPage <= page) {
        throw new Error('Incomplete pagination metadata; reserved slug scan aborted.')
      }
      page = result.nextPage
    }
  }
  return [...conflicts.values()].sort(
    (a, b) =>
      a.id.localeCompare(b.id) || a.slug.localeCompare(b.slug) || a.status.localeCompare(b.status),
  )
}

async function main() {
  const { database, label } = describeDatabaseTarget(process.env.DATABASE_URI ?? '')
  process.stderr.write(
    `Reserved slug scan target: database=${label}; storage=${process.env.DISABLE_R2_STORAGE === 'true' ? 'disabled' : 'configured adapter'}; mode=read-only\n`,
  )
  parseScanArguments(process.argv.slice(2), database)
  // Validate the target and confirmation before loading application config or connecting.
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const payload = await getPayload({ config })
  try {
    process.stdout.write(`${JSON.stringify(await scanReservedSlugs(payload), null, 2)}\n`)
  } finally {
    await payload.destroy()
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
