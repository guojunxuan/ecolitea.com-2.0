import type { Block } from 'payload'
import { defaultLexical } from '@/fields/defaultLexical'

export const Prose: Block = {
  slug: 'prose',
  interfaceName: 'ProseBlock',
  labels: { singular: 'Prose', plural: 'Prose' },
  admin: {
    group: 'Content',
    disableBlockName: true,
    images: { icon: '/block-previews/prose.svg', thumbnail: '/block-previews/prose.svg' },
    components: { Label: '@/blocks/BlockRowLabel#BlockRowLabel' },
  },
  fields: [{ name: 'content', type: 'richText', editor: defaultLexical, required: true }],
}
