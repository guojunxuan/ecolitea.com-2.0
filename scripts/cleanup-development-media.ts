import { pathToFileURL } from 'node:url'

type DocumentLike = Record<string, unknown>

type PageResult = {
  docs: unknown[]
  hasNextPage?: boolean
  nextPage?: null | number
}

export type CleanupPayload = {
  delete: (args: {
    collection: 'media'
    context: { disableRevalidate: true }
    where: { id: { in: string[] } }
  }) => Promise<unknown>
  find: (args: {
    collection: string
    depth: number
    limit: number
    overrideAccess: boolean
    page: number
    showHiddenFields: boolean
    sort: string
  }) => Promise<PageResult>
  findVersions: (args: {
    collection: string
    depth: number
    limit: number
    overrideAccess: boolean
    page: number
    showHiddenFields: boolean
    sort: string
  }) => Promise<PageResult>
}

export type MediaInventoryItem = {
  filename: null | string
  id: string
  legacySizeFilenames: string[]
  url: null | string
}

export type MediaReference = {
  documentID: string
  mediaIDs: string[]
  paths: string[]
  source: `${ReferenceCollection}:${'current' | 'version'}`
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

type ReferenceCollection = (typeof CURRENT_REFERENCE_COLLECTIONS)[number]

const CURRENT_REFERENCE_COLLECTIONS = ['case-studies', 'pages', 'posts', 'search'] as const
const VERSIONED_REFERENCE_COLLECTIONS = ['case-studies', 'pages', 'posts'] as const
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

export function buildMediaInventory(documents: unknown[]): MediaInventoryItem[] {
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

      return {
        filename: typeof document.filename === 'string' ? document.filename : null,
        id: String(document.id),
        legacySizeFilenames: getLegacySizeFilenames(document.sizes),
        url: typeof document.url === 'string' ? document.url : null,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

export async function findMediaReferences(
  payload: Pick<CleanupPayload, 'find' | 'findVersions'>,
  mediaIDs: string[],
): Promise<MediaReference[]> {
  if (mediaIDs.length === 0) return []

  const targetIDs = new Set(mediaIDs)
  const references: MediaReference[] = []

  for (const collection of CURRENT_REFERENCE_COLLECTIONS) {
    const documents = await findAll((page) => payload.find(queryArguments(collection, page)))
    references.push(...findReferencesInDocuments(documents, collection, 'current', targetIDs))
  }

  for (const collection of VERSIONED_REFERENCE_COLLECTIONS) {
    const versions = await findAll((page) => payload.findVersions(queryArguments(collection, page)))
    references.push(...findReferencesInDocuments(versions, collection, 'version', targetIDs))
  }

  return references.sort(
    (left, right) =>
      left.source.localeCompare(right.source) || left.documentID.localeCompare(right.documentID),
  )
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
  const inventory = buildMediaInventory(mediaDocuments)
  const references = await findMediaReferences(
    payload,
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

function queryArguments(collection: string, page: number) {
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

function findReferencesInDocuments(
  documents: unknown[],
  collection: ReferenceCollection,
  kind: 'current' | 'version',
  targetIDs: Set<string>,
): MediaReference[] {
  return documents.flatMap((document, index) => {
    if (!isDocumentLike(document)) {
      throw new Error(
        `Incomplete reference inspection: ${collection}:${kind} result ${index} is invalid.`,
      )
    }
    if (document.id === undefined) {
      throw new Error(
        `Incomplete reference inspection: ${collection}:${kind} result ${index} has no ID.`,
      )
    }
    if (kind === 'version' && !isDocumentLike(document.version)) {
      throw new Error(
        `Incomplete reference inspection: ${collection}:version result ${String(document.id)} has no version data.`,
      )
    }

    const paths = findTargetPaths(kind === 'version' ? document.version : document, targetIDs)
    if (paths.length === 0) return []

    return [
      {
        documentID: String(document.id),
        mediaIDs: [...new Set(paths.map(({ id }) => id))].sort(),
        paths: paths.map(({ path }) => path).sort(),
        source: `${collection}:${kind}` as const,
      },
    ]
  })
}

function findTargetPaths(
  value: unknown,
  targetIDs: Set<string>,
  path = '$',
  seen = new Set<object>(),
): Array<{ id: string; path: string }> {
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value)
    return targetIDs.has(id) ? [{ id, path }] : []
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return []
  seen.add(value)

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findTargetPaths(entry, targetIDs, `${path}[${index}]`, seen),
    )
  }

  return Object.entries(value).flatMap(([key, entry]) =>
    findTargetPaths(entry, targetIDs, `${path}.${key}`, seen),
  )
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
