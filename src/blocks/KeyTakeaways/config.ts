import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'

export const KeyTakeaways: Block = {
  slug: 'keyTakeaways',
  interfaceName: 'KeyTakeawaysBlock',
  labels: { singular: 'Key Takeaways', plural: 'Key Takeaways' },
  admin: {
    group: 'Content',
    disableBlockName: true,
    images: {
      icon: '/block-previews/key-takeaways.svg',
      thumbnail: '/block-previews/key-takeaways.svg',
    },
    components: { Label: '@/blocks/BlockRowLabel#BlockRowLabel' },
  },
  fields: [
    { name: 'label', type: 'text', defaultValue: 'At a Glance' },
    { name: 'content', type: 'richText', editor: compactLexical, required: true },
  ],
}
