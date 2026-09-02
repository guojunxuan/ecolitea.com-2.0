import type { CollectionConfig, UploadFieldValidation } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const socialPlatformsSlug = 'social-platforms' as const

const svgMimeType = 'image/svg+xml'
const invalidIconMessage = 'Social platform icons must be SVG files.'

export const validateSocialPlatformIcon: UploadFieldValidation = async (value, { req }) => {
  if (!value) return true

  if (typeof value === 'object' && 'mimeType' in value) {
    return value.mimeType === svgMimeType || invalidIconMessage
  }

  const id = typeof value === 'object' && 'id' in value ? value.id : value
  const asset = await req.payload.findByID({
    collection: 'brand-assets',
    id: String(id),
    req,
  })

  return asset.mimeType === svgMimeType || invalidIconMessage
}

export const SocialPlatforms: CollectionConfig = {
  slug: socialPlatformsSlug,
  admin: {
    hidden: true,
    useAsTitle: 'platform',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'platform',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'brand-assets',
      required: true,
      filterOptions: { mimeType: { equals: svgMimeType } },
      validate: validateSocialPlatformIcon,
    },
  ],
}
