import {
  APIError,
  type CollectionConfig,
  type FieldHook,
  type TextFieldValidation,
  type UploadFieldValidation,
  validations,
} from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const socialPlatformsSlug = 'social-platforms' as const

const svgMimeType = 'image/svg+xml'
const invalidIconMessage = 'Social platform icons must be SVG files.'
const missingIconMessage = 'An SVG icon is required.'
const unavailableIconMessage = 'Select an existing SVG brand asset.'

export const validateSocialPlatformName: TextFieldValidation = async (value, options) => {
  const defaultResult = validations.text(value, options)
  if (defaultResult !== true || !value || typeof options.req?.payload?.find !== 'function') {
    return defaultResult
  }

  const { docs } = await options.req.payload.find({
    collection: socialPlatformsSlug,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
    where: {
      platform: {
        equals: value,
      },
    },
  })
  const duplicate = docs.some((document) => String(document.id) !== String(options.id ?? ''))

  return duplicate ? `A Social Platform named "${value}" already exists.` : true
}

export const preventSocialPlatformRename: FieldHook = ({ operation, originalDoc, value }) => {
  if (operation === 'update' && originalDoc?.platform !== value) {
    throw new APIError('Platform cannot be changed after creation.', 400)
  }

  return value
}

export const validateSocialPlatformIcon: UploadFieldValidation = async (value, { req }) => {
  if (!value) return missingIconMessage

  if (typeof value === 'object' && 'mimeType' in value) {
    return value.mimeType === svgMimeType || invalidIconMessage
  }

  const id = typeof value === 'object' && 'id' in value ? value.id : value
  let asset
  try {
    asset = await req.payload.findByID({
      collection: 'brand-assets',
      id: String(id),
      req,
    })
  } catch {
    return unavailableIconMessage
  }

  return asset.mimeType === svgMimeType || invalidIconMessage
}

export const SocialPlatforms: CollectionConfig = {
  slug: socialPlatformsSlug,
  disableDuplicate: true,
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
      unique: true,
      validate: validateSocialPlatformName,
      admin: {
        description: 'Platform names cannot be changed after creation.',
        components: {
          Field: '@/SiteSettings/components/SocialPlatformNameField#SocialPlatformNameField',
        },
      },
      hooks: {
        beforeChange: [preventSocialPlatformRename],
      },
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
