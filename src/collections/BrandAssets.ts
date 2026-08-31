import type { CollectionConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const brandAssetMimeTypes = [
  'image/svg+xml',
  'image/png',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]

export const BrandAssets: CollectionConfig = {
  slug: 'brand-assets',
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
    mimeTypes: brandAssetMimeTypes,
  },
}
