import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { getProductAspectRatioOptions } from '../shared/aspectRatioOptions'
import { playbackField } from '../shared/playbackCondition'
import { themeField } from '../shared/themeField'

export const MediaTabs: Block = {
  slug: 'productMediaTabs',
  interfaceName: 'ProductMediaTabsBlock',
  labels: { singular: 'Media Tabs', plural: 'Media Tabs' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Tabs' },
      },
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      maxLength: 80,
      admin: { description: 'Media tabs for comparing product colors or usage scenes.' },
    },
    {
      name: 'tabs',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      admin: { initCollapsed: true },
      fields: [
        { name: 'label', type: 'text', required: true, maxLength: 40 },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOrVideo,
          required: true,
        },
        { ...playbackField },
      ],
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: getProductAspectRatioOptions(['21:9', '16:9', '4:3', '1:1']),
      defaultValue: '16:9',
      required: true,
    },
    { ...themeField },
  ],
}
