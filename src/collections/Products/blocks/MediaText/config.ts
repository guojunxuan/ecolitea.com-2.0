import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { compactLexical } from '@/fields/compactLexical'
import { getProductAspectRatioOptions } from '../shared/aspectRatioOptions'
import { playbackField } from '../shared/playbackCondition'
import { themeField } from '../shared/themeField'

export const MediaText: Block = {
  slug: 'productMediaText',
  interfaceName: 'ProductMediaTextBlock',
  labels: { singular: 'Media + Text', plural: 'Media + Text' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media + Text' },
      },
    },
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      maxLength: 40,
      admin: { description: 'Media and text side by side for a product feature or story.' },
    },
    { name: 'title', type: 'text', required: true, maxLength: 80 },
    { name: 'body', type: 'richText', editor: compactLexical },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
      required: true,
    },
    { ...playbackField },
    {
      name: 'mediaPosition',
      label: 'Media Position',
      type: 'select',
      options: [
        { label: 'Right', value: 'right' },
        { label: 'Left', value: 'left' },
      ],
      defaultValue: 'right',
      required: true,
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: getProductAspectRatioOptions(['21:9', '16:9', '4:3', '1:1', '4:5', 'original']),
      defaultValue: '1:1',
      required: true,
    },
    { ...themeField },
  ],
}
