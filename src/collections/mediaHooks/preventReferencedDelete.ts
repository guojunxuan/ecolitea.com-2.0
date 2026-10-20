import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { findMediaReferences } from '../mediaReferences'

function labelText(label: unknown): string | undefined {
  if (typeof label === 'string' && label.trim()) return label
  if (label && typeof label === 'object') {
    const localized = label as Record<string, unknown>
    return (
      labelText(localized.en) ??
      Object.values(localized).find(
        (value): value is string => typeof value === 'string' && Boolean(value.trim()),
      )
    )
  }
  return undefined
}

export const preventReferencedDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = (await findMediaReferences(req.payload, [id], req)).filter(
    ({ kind }) => kind === 'current',
  )
  if (!references.length) return
  const owners = new Set<string>()
  const locations: string[] = []
  for (const reference of references) {
    const { ownerType, ownerSlug, title } = reference
    const key = JSON.stringify([ownerType, ownerSlug, reference.documentID])
    if (owners.has(key)) continue
    owners.add(key)
    const configuredLabel =
      ownerType === 'collection'
        ? req.payload.config.collections.find(({ slug }) => slug === ownerSlug)?.labels?.singular
        : req.payload.config.globals.find(({ slug }) => slug === ownerSlug)?.label
    const label = labelText(configuredLabel) ?? ownerSlug
    locations.push(`${label}${ownerType === 'collection' ? ` "${title}"` : ''}`)
  }
  const shown = locations.slice(0, 3)
  const summary =
    shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
  const remainder =
    locations.length > shown.length ? ` … and ${locations.length - shown.length} more` : ''
  throw new APIError(`Can't delete: used in ${summary}${remainder}. Remove it there first.`, 400)
}
