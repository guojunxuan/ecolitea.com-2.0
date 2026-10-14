import type { CollectionConfig, UploadFieldValidation } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const siteAssetMimeTypes = [
  'image/svg+xml',
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

const svgMimeType = 'image/svg+xml'
const invalidIconMessage = 'Icons must be SVG files.'
const missingIconMessage = 'An SVG icon is required.'
const unavailableIconMessage = 'Select an existing SVG site asset.'

export const validateSvgSiteAsset: UploadFieldValidation = async (value, { req }) => {
  if (!value) return missingIconMessage

  if (typeof value === 'object' && 'mimeType' in value) {
    return value.mimeType === svgMimeType || invalidIconMessage
  }

  const id = typeof value === 'object' && 'id' in value ? value.id : value
  let asset
  try {
    asset = await req.payload.findByID({
      collection: 'site-assets',
      id: String(id),
      req,
    })
  } catch {
    return unavailableIconMessage
  }

  return asset.mimeType === svgMimeType || invalidIconMessage
}

export const SiteAssets: CollectionConfig = {
  slug: 'site-assets',
  labels: { singular: 'Site Asset', plural: 'Site Assets' },
  admin: {
    hidden: true,
    useAsTitle: 'filename',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    mimeTypes: siteAssetMimeTypes,
  },
}
