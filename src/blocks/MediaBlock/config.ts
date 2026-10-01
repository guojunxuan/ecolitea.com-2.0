import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'

export const MediaBlock: Block = {
  slug: 'mediaBlock',
  interfaceName: 'MediaBlock',
  labels: { singular: 'Media', plural: 'Media' },
  admin: {
    group: 'Media',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
    components: { Label: '@/blocks/BlockRowLabel#BlockRowLabel' },
  },
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'richText', editor: compactLexical },
    {
      name: 'width',
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Wide', value: 'wide' },
      ],
      defaultValue: 'default',
    },
  ],
}
