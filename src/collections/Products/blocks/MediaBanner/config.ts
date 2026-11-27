import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { productAspectRatioField } from '../shared/aspectRatio'
import { playbackField } from '../shared/playbackField'

export const MediaBanner: Block = {
  slug: 'productMediaBanner',
  interfaceName: 'ProductMediaBannerBlock',
  labels: { singular: 'Media Banner', plural: 'Media Banners' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: {
      icon: '/block-previews/product-media-banner.svg',
      thumbnail: '/block-previews/product-media-banner.svg',
    },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Banner' },
      },
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      maxLength: 80,
      admin: { description: 'A wide media banner with an overlaid title and short centered copy.' },
    },
    { name: 'body', type: 'textarea', maxLength: 200 },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
      required: true,
    },
    {
      name: 'mobileMedia',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
    },
    playbackField,
    {
      type: 'row',
      fields: [
        productAspectRatioField({
          values: ['full-screen', '21:9', '16:9'],
          defaultValue: '21:9',
        }),
      ],
    },
  ],
}
