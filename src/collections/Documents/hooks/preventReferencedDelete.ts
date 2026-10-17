import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { findDocumentReferences, documentOwnerLabel } from '../references'

export const preventReferencedDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = (await findDocumentReferences(req.payload, [id], req)).filter(
    ({ kind }) => kind === 'current',
  )
  if (!references.length) return
  const locations = references.map(
    ({ ownerType, ownerSlug, title, path }) =>
      `${documentOwnerLabel(ownerSlug)}${ownerType === 'collection' ? ` "${title}"` : ''} (${path})`,
  )
  throw new APIError(
    `Cannot delete: this document is used in ${locations.join(', ')}. Remove these references first.`,
    400,
  )
}
