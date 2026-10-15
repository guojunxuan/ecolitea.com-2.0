import { ValidationError, type GlobalBeforeChangeHook } from 'payload'

import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'

// Global hooks run even when a conditional field is hidden in the Admin UI.
export const validateSettingsHeroImage: GlobalBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const incomingImage = data?.blog?.hero?.image
  const image = incomingImage === undefined ? originalDoc?.blog?.hero?.image : incomingImage
  if (image === undefined || image === null) return data

  const id = typeof image === 'object' ? image.id : image
  const media = await req.payload.findByID({
    collection: 'media',
    id: String(id),
    depth: 0,
    req,
  })

  if (!(MEDIA_UPLOAD_POLICY.image.mimeTypes as readonly string[]).includes(media.mimeType ?? '')) {
    throw new ValidationError({
      global: 'settings',
      errors: [
        {
          path: 'blog.hero.image',
          message: 'Hero image must be an image from Media.',
        },
      ],
    })
  }

  return data
}
