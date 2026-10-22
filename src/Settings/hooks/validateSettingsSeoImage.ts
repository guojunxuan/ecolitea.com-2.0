import { ValidationError, type GlobalBeforeChangeHook } from 'payload'

import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'

export const validateSettingsSeoImage: GlobalBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  for (const section of ['blog', 'product'] as const) {
    const incomingImage = data?.[section]?.seo?.image
    const image = incomingImage === undefined ? originalDoc?.[section]?.seo?.image : incomingImage
    if (image === undefined || image === null) continue

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
            path: `${section}.seo.image`,
            message: 'SEO image must be an image from Media.',
          },
        ],
      })
    }
  }

  return data
}
