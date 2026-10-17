import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { findMediaReferences, mediaOwnerLabel } from '../mediaReferences'

export const preventReferencedDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const references = (await findMediaReferences(req.payload, [id], req)).filter(
    ({ kind }) => kind === 'current',
  )
  if (!references.length) return
  const locations = references.map(
    ({ ownerType, ownerSlug, title, path }) =>
      `${mediaOwnerLabel(ownerSlug)}${ownerType === 'collection' ? ` "${title}"` : ''} (${path})`,
  )
  throw new APIError(
    `Cannot delete: this media is used in ${locations.join(', ')}. Remove these references first.`,
    400,
  )
}
