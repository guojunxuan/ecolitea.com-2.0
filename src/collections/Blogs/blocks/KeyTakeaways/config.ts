import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'

export const KeyTakeaways: Block = {
  slug: 'blogKeyTakeaways',
  interfaceName: 'BlogKeyTakeawaysBlock',
  labels: { singular: 'Key Points', plural: 'Key Points' },
  admin: {
    group: 'Blogs',
    disableBlockName: true,
    images: {
      icon: '/block-previews/key-takeaways.svg',
      thumbnail: '/block-previews/key-takeaways.svg',
    },
    components: {
      Block: '@/blocks/ArticleBlockEditor#ArticleBlockEditor',
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Key Points' },
      },
    },
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      label: 'Block Title',
      admin: { description: 'Highlight the article’s summary, conclusions, or key points.' },
    },
    {
      name: 'content',
      label: 'Key Points',
      type: 'richText',
      editor: compactLexical,
      required: true,
    },
  ],
}
