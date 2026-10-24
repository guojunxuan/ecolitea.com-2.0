import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { getProductAspectRatioOptions } from '../shared/aspectRatioOptions'
import { playbackField } from '../shared/playbackCondition'
import { themeField } from '../shared/themeField'

export const MediaCarousel: Block = {
  slug: 'productMediaCarousel',
  interfaceName: 'ProductMediaCarouselBlock',
  labels: { singular: 'Media Carousel', plural: 'Media Carousels' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Carousel' },
      },
    },
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      maxLength: 40,
      admin: { description: 'A media carousel for product views or usage scenes.' },
    },
    { name: 'title', type: 'text', maxLength: 80 },
    {
      name: 'slides',
      type: 'array',
      minRows: 2,
      maxRows: 12,
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOrVideo,
          required: true,
        },
        { ...playbackField },
        { name: 'caption', type: 'text', maxLength: 120 },
      ],
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: getProductAspectRatioOptions(['21:9', '16:9', '4:3']),
      defaultValue: '16:9',
      required: true,
    },
    { ...themeField },
  ],
}
