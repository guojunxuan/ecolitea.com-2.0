import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { getProductAspectRatioOptions } from '../shared/aspectRatioOptions'
import { themeField } from '../shared/themeField'

export const MediaBanner: Block = {
  slug: 'productMediaBanner',
  interfaceName: 'ProductMediaBannerBlock',
  labels: { singular: 'Media Banner', plural: 'Media Banners' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Banner' },
      },
    },
  },
  fields: [
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
      required: true,
      admin: { description: 'A wide media banner with an overlaid title and short centered copy.' },
    },
    { name: 'title', type: 'text', required: true, maxLength: 80 },
    { name: 'content', type: 'textarea', maxLength: 200 },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: [
        { label: 'Full Screen', value: 'full-screen' },
        ...getProductAspectRatioOptions(['21:9', '16:9', 'original']).map((option) => ({
          ...option,
          label:
            option.value === '21:9'
              ? 'Wide 21:9'
              : option.value === '16:9'
                ? 'Standard 16:9'
                : option.label,
        })),
      ],
      defaultValue: '16:9',
      required: true,
    },
    { ...themeField },
  ],
}
