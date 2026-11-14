import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { productAspectRatioField } from '../shared/aspectRatio'
import { playbackField } from '../shared/playbackField'

export const MediaTabs: Block = {
  slug: 'productMediaTabs',
  interfaceName: 'ProductMediaTabsBlock',
  labels: { singular: 'Media Tabs', plural: 'Media Tabs' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: {
      icon: '/block-previews/product-media-tabs.svg',
      thumbnail: '/block-previews/product-media-tabs.svg',
    },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Tabs' },
      },
    },
  },
  fields: [
    { name: 'title', type: 'text', maxLength: 80 },
    {
      name: 'tabs',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      admin: { initCollapsed: true },
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 40 },
        { name: 'description', type: 'textarea' },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOrVideo,
          required: true,
        },
        playbackField,
      ],
    },
    {
      type: 'row',
      fields: [
        productAspectRatioField({ values: ['21:9', '16:9', '4:3', '1:1'], defaultValue: '21:9' }),
      ],
    },
  ],
}
