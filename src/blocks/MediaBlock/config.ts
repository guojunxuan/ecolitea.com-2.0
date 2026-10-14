import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'
import { mediaAspectRatioOptions } from './aspectRatio'

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  labels: { singular: 'Media', plural: 'Media' },
  admin: {
    group: 'Media',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: {
      Block: '@/blocks/ArticleBlockEditor#ArticleBlockEditor',
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { blockType: 'mediaBlock' },
      },
    },
  },
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'richText', editor: compactLexical },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: mediaAspectRatioOptions,
      defaultValue: 'original',
      admin: {
        description:
          'Original keeps the media proportions. Other ratios crop the image or video to fill the frame.',
      },
    },
    {
      name: 'width',
      admin: { hidden: true },
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Wide', value: 'wide' },
      ],
      defaultValue: 'default',
    },
  ],
}
