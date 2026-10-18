import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest } from 'payload'

export type MediaReference = {
  mediaID: string
  kind: 'current' | 'version'
  ownerType: 'collection' | 'global'
  ownerSlug: string
  documentID?: string
  title: string
  path: string
  editURL: string
}

type Document = Record<string, unknown>
type Owner = { slug: string; titleField?: string; label: string }

const incomplete = () => new Error('Incomplete reference inspection; media deletion is unsafe.')
const isDocument = (value: unknown): value is Document =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isID = (value: unknown): value is string | number =>
  (typeof value === 'string' && value.length > 0) ||
  (typeof value === 'number' && Number.isFinite(value))

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (isDocument(value))
    return Object.values(value).find((entry) => typeof entry === 'string' && entry.trim()) as
      string | undefined
  return undefined
}

export function mediaOwnerLabel(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Privileged internal inspection. Callers exposing results must authenticate first. */
export async function findMediaReferences(
  payload: Payload,
  ids: readonly (string | number)[],
  req?: PayloadRequest,
): Promise<MediaReference[]> {
  if (!ids.length) return []
  const targets = new Set(ids.map(String))
  const references: MediaReference[] = []
  const adminRoute = payload.config.routes.admin.replace(/\/$/, '')
  const options = {
    depth: 0,
    locale: 'all' as const,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  }
  const paging = { ...options, limit: 100, sort: 'id' }

  function inspect(
    value: unknown,
    owner: Owner,
    ownerType: MediaReference['ownerType'],
    kind: MediaReference['kind'],
  ) {
    if (!isDocument(value)) throw incomplete()
    const data = kind === 'version' ? value.version : value
    if (!isDocument(data)) throw incomplete()
    if ((ownerType === 'collection' || kind === 'version') && !isID(value.id)) throw incomplete()
    const documentID =
      ownerType === 'collection'
        ? kind === 'version'
          ? isID(value.parent)
            ? String(value.parent)
            : undefined
          : String(value.id)
        : undefined
    const title =
      text(data[owner.titleField && owner.titleField !== 'id' ? owner.titleField : 'title']) ??
      text(data.title) ??
      text(data.name) ??
      text(data.filename) ??
      owner.label
    const editURL =
      ownerType === 'global'
        ? `${adminRoute}/globals/${encodeURIComponent(owner.slug)}`
        : `${adminRoute}/collections/${encodeURIComponent(owner.slug)}${documentID ? `/${encodeURIComponent(documentID)}` : ''}`
    for (const match of targetPaths(data, targets)) {
      references.push({
        ...match,
        kind,
        ownerType,
        ownerSlug: owner.slug,
        ...(documentID ? { documentID } : {}),
        title,
        editURL,
      })
    }
  }

  for (const collection of payload.config.collections) {
    // Native edit locks and recent-document preferences are editor state, not content use.
    if (
      collection.slug === 'media' ||
      collection.slug === 'payload-locked-documents' ||
      collection.slug === 'payload-preferences'
    )
      continue
    const owner = {
      slug: collection.slug,
      titleField: collection.admin?.useAsTitle,
      label: text(collection.labels?.plural) ?? mediaOwnerLabel(collection.slug),
    }
    const collectionSlug = collection.slug as CollectionSlug
    for (const doc of await allPages((page) =>
      payload.find({ ...paging, collection: collectionSlug, page, trash: true }),
    ))
      inspect(doc, owner, 'collection', 'current')
    if (collection.versions) {
      for (const version of await allPages((page) =>
        payload.findVersions({ ...paging, collection: collectionSlug, page, trash: true }),
      ))
        inspect(version, owner, 'collection', 'version')
    }
  }
  for (const global of payload.config.globals) {
    const owner = { slug: global.slug, label: text(global.label) ?? mediaOwnerLabel(global.slug) }
    const slug = global.slug as GlobalSlug
    inspect(await payload.findGlobal({ ...options, slug }), owner, 'global', 'current')
    if (global.versions) {
      for (const version of await allPages((page) =>
        payload.findGlobalVersions({ ...paging, slug, page }),
      ))
        inspect(version, owner, 'global', 'version')
    }
  }
  return references
}

async function allPages(fetchPage: (page: number) => Promise<unknown>): Promise<unknown[]> {
  const docs: unknown[] = []
  const seenIDs = new Set<string>()
  let page = 1
  let total: number | undefined
  while (true) {
    const result = await fetchPage(page)
    if (
      !isDocument(result) ||
      !Array.isArray(result.docs) ||
      typeof result.hasNextPage !== 'boolean' ||
      !Number.isInteger(result.totalDocs) ||
      (result.totalDocs as number) < 0 ||
      !Number.isInteger(result.totalPages) ||
      (result.totalPages as number) < 0 ||
      result.page !== page
    )
      throw incomplete()
    if (total !== undefined && result.totalDocs !== total) throw incomplete()
    total = result.totalDocs as number
    for (const doc of result.docs) {
      if (!isDocument(doc) || !isID(doc.id) || seenIDs.has(String(doc.id))) throw incomplete()
      seenIDs.add(String(doc.id))
    }
    docs.push(...result.docs)
    if (docs.length > total) throw incomplete()
    if (!result.hasNextPage) {
      if (docs.length !== total || page < (result.totalPages as number)) throw incomplete()
      return docs
    }
    if (
      !result.docs.length ||
      docs.length >= total ||
      result.nextPage !== page + 1 ||
      page >= (result.totalPages as number)
    )
      throw incomplete()
    page++
  }
}

function targetPaths(
  value: unknown,
  targets: Set<string>,
  path = '',
  ancestors = new Set<object>(),
): Array<{ mediaID: string; path: string }> {
  if (isID(value)) return targets.has(String(value)) ? [{ mediaID: String(value), path }] : []
  if (!value || typeof value !== 'object' || ancestors.has(value)) return []
  ancestors.add(value)
  const matches = Array.isArray(value)
    ? value.flatMap((item, index) => targetPaths(item, targets, `${path}[${index}]`, ancestors))
    : Object.entries(value).flatMap(([key, item]) =>
        targetPaths(item, targets, path ? `${path}.${key}` : key, ancestors),
      )
  ancestors.delete(value)
  return matches
}
