import { ValidationError, type GlobalBeforeChangeHook } from 'payload'
import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'

/** Read persisted metadata, never trust mimeType supplied in a relationship object. */
export const validateProductListingMedia: GlobalBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const slides =
    data?.product?.heroSlides === undefined
      ? originalDoc?.product?.heroSlides
      : data.product.heroSlides
  const allowed: readonly string[] = [
    ...MEDIA_UPLOAD_POLICY.image.mimeTypes,
    ...MEDIA_UPLOAD_POLICY.video.mimeTypes,
  ]
  const mediaByID = new Map<string, Promise<{ mimeType?: string | null } | null>>()
  for (const [index, slide] of (slides ?? []).entries()) {
    for (const field of ['media', 'mobileMedia'] as const) {
      const value = slide?.[field]
      if (value === undefined || value === null) continue
      const id = String(typeof value === 'object' ? value.id : value)
      if (!mediaByID.has(id))
        mediaByID.set(
          id,
          req.payload.findByID({ collection: 'media', id, depth: 0, disableErrors: true, req }),
        )
      const media = await mediaByID.get(id)
      if (!allowed.includes(media?.mimeType ?? ''))
        throw new ValidationError({
          global: 'settings',
          errors: [
            {
              path: `product.heroSlides.${index}.${field}`,
              message: 'Slide media must be an allowed image or MP4 video from Media.',
            },
          ],
        })
    }
  }
  return data
}
