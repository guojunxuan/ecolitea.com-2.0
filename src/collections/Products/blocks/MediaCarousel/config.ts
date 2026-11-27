import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { productAspectRatioField } from '../shared/aspectRatio'
import { playbackField } from '../shared/playbackField'

export const MediaCarousel: Block = {
  slug: 'productMediaCarousel',
  interfaceName: 'ProductMediaCarouselBlock',
  labels: { singular: 'Media Carousel', plural: 'Media Carousels' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: {
      icon: '/block-previews/product-media-carousel.svg',
      thumbnail: '/block-previews/product-media-carousel.svg',
    },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Carousel' },
      },
    },
  },
  fields: [
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
        playbackField,
        { name: 'caption', type: 'text', maxLength: 120 },
      ],
    },
    {
      type: 'row',
      fields: [productAspectRatioField({ values: ['21:9', '16:9', '4:3'], defaultValue: '21:9' })],
    },
  ],
}
