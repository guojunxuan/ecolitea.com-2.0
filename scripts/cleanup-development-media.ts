import { pathToFileURL } from 'node:url'
import type { Payload } from 'payload'
import { findMediaReferences, type MediaReference } from '../src/collections/mediaReferences'
export { findMediaReferences } from '../src/collections/mediaReferences'

type DocumentLike = Record<string, unknown>

type PageResult = {
  docs: unknown[]
  hasNextPage?: boolean
  nextPage?: null | number
}

export type CleanupPayload = Pick<
  Payload,
  'config' | 'delete' | 'find' | 'findVersions' | 'findGlobal' | 'findGlobalVersions'
>

export type MediaInventoryItem = {
  filename: string
  id: string
  legacySizeFilenames: string[]
  url: string
}

export type CleanupReport = {
  inventory: MediaInventoryItem[]
  mode: 'dry-run' | 'execute'
  origin: string
  references: MediaReference[]
}

export class MediaCleanupBlockedError extends Error {
  report: CleanupReport

  constructor(report: CleanupReport) {
    super(
      `Media cleanup aborted before deletion because references remain (${report.references.length} persisted reference(s)).`,
    )
    this.name = 'MediaCleanupBlockedError'
    this.report = report
  }
}

const PAGE_LIMIT = 100

export function parseCleanupArguments(argv: string[]): {
  execute: boolean
  expectedOrigin: string
} {
  let execute = false
  let expectedOrigin: string | undefined

  for (const [index, argument] of argv.entries()) {
    if (argument === '--' && index === 0) continue
    if (argument === '--execute') {
      if (execute) throw new Error('Duplicate argument: --execute')
      execute = true
      continue
    }

    if (argument === '--expected-origin') {
      throw new Error('Malformed --expected-origin; use --expected-origin=<origin>.')
    }

    if (argument.startsWith('--expected-origin=')) {
      if (expectedOrigin !== undefined) throw new Error('Duplicate argument: --expected-origin')
      expectedOrigin = argument.slice('--expected-origin='.length)
      if (!expectedOrigin)
        throw new Error('Malformed --expected-origin; the value cannot be empty.')
      continue
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  if (!expectedOrigin) {
    throw new Error('An explicit --expected-origin=<origin> is required.')
  }

  return { execute, expectedOrigin }
}

export function normalizeHTTPOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Expected a valid URL origin, received: ${value}`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Expected origin must use HTTP or HTTPS.')
  }

  return url.origin
}

export function buildMediaInventory(
  documents: unknown[],
  expectedOrigin: string,
): MediaInventoryItem[] {
  const normalizedExpectedOrigin = normalizeHTTPOrigin(expectedOrigin)

  return documents
    .map((document) => {
      if (!isDocumentLike(document)) {
        throw new Error('Incomplete media inventory: every result must be a Media document.')
      }
      if (
        (typeof document.id !== 'string' && typeof document.id !== 'number') ||
        String(document.id).length === 0
      ) {
        throw new Error('Incomplete media inventory: every Media document must have an ID.')
      }
      if (typeof document.filename !== 'string' || document.filename.trim().length === 0) {
        throw new Error(
          `Incomplete media inventory: Media ${String(document.id)} has no original filename.`,
        )
      }
      if (typeof document.url !== 'string' || document.url.trim().length === 0) {
        throw new Error(
          `Incomplete media inventory: Media ${String(document.id)} has no original URL.`,
        )
      }

      let mediaOrigin: string
      try {
        mediaOrigin = normalizeHTTPOrigin(document.url)
      } catch {
        throw new Error(
          `Incomplete media inventory: Media ${String(document.id)} has an invalid original URL.`,
        )
      }
      if (mediaOrigin !== normalizedExpectedOrigin) {
        throw new Error(
          `Media ${String(document.id)} is outside configured R2 origin ${normalizedExpectedOrigin}.`,
        )
      }

      return {
        filename: document.filename,
        id: String(document.id),
        legacySizeFilenames: getLegacySizeFilenames(document.sizes),
        url: document.url,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

export async function runMediaCleanup({
  configuredOrigin,
  execute = false,
  expectedOrigin,
  payload,
}: {
  configuredOrigin: string
  execute?: boolean
  expectedOrigin: string
  payload: CleanupPayload
}): Promise<CleanupReport> {
  const normalizedExpectedOrigin = normalizeHTTPOrigin(expectedOrigin)
  const normalizedConfiguredOrigin = normalizeHTTPOrigin(configuredOrigin)

  if (normalizedExpectedOrigin !== normalizedConfiguredOrigin) {
    throw new Error(
      `Expected origin ${normalizedExpectedOrigin} does not match configured R2 origin ${normalizedConfiguredOrigin}.`,
    )
  }

  const mediaDocuments = await findAll((page) => payload.find(queryArguments('media', page)))
  const inventory = buildMediaInventory(mediaDocuments, normalizedConfiguredOrigin)
  const references = await findMediaReferences(
    payload as Payload,
    inventory.map(({ id }) => id),
  )
  const report: CleanupReport = {
    inventory,
    mode: execute ? 'execute' : 'dry-run',
    origin: normalizedConfiguredOrigin,
    references,
  }

  if (!execute || inventory.length === 0) return report

  if (references.length > 0) {
    throw new MediaCleanupBlockedError(report)
  }

  await payload.delete({
    collection: 'media',
    context: { disableRevalidate: true },
    where: { id: { in: inventory.map(({ id }) => id) } },
  })

  return report
}

function queryArguments(collection: 'media', page: number) {
  return {
    collection,
    depth: 0,
    limit: PAGE_LIMIT,
    overrideAccess: true,
    page,
    showHiddenFields: true,
    sort: 'id',
  }
}

async function findAll(fetchPage: (page: number) => Promise<PageResult>): Promise<unknown[]> {
  const documents: unknown[] = []
  let page = 1

  while (true) {
    const result = await fetchPage(page)
    documents.push(...result.docs)
    if (!result.hasNextPage) return documents
    if (typeof result.nextPage !== 'number' || result.nextPage <= page) {
      throw new Error('Reference inspection returned incomplete pagination metadata.')
    }
    page = result.nextPage
  }
}

function getLegacySizeFilenames(value: unknown): string[] {
  if (!isDocumentLike(value)) return []
  return Object.values(value)
    .flatMap((size) =>
      isDocumentLike(size) && typeof size.filename === 'string' ? [size.filename] : [],
    )
    .sort()
}

function isDocumentLike(value: unknown): value is DocumentLike {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function main() {
  const { execute, expectedOrigin } = parseCleanupArguments(process.argv.slice(2))
  const configuredOrigin = process.env.R2_PUBLIC_URL
  if (!configuredOrigin) throw new Error('R2_PUBLIC_URL is not configured.')

  // Keep Payload and environment-heavy configuration out of import-time helper usage.
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('../src/payload.config'),
  ])
  const target = new URL(process.env.DATABASE_URI ?? '')
  process.stderr.write(
    `Media cleanup target: database=${target.host}${target.pathname}; storage=${process.env.DISABLE_R2_STORAGE === 'true' ? 'local (R2 disabled)' : `R2 bucket=${process.env.R2_BUCKET ?? 'unconfigured'}`}; public origin=${normalizeHTTPOrigin(configuredOrigin)}; mode=${execute ? 'execute' : 'dry-run'}\n`,
  )
  const payload = await getPayload({ config })

  try {
    try {
      const report = await runMediaCleanup({
        configuredOrigin,
        execute,
        expectedOrigin,
        payload: payload as unknown as CleanupPayload,
      })
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } catch (error) {
      if (error instanceof MediaCleanupBlockedError) {
        process.stdout.write(`${JSON.stringify(error.report, null, 2)}\n`)
      }
      throw error
    }
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
