import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'

export const Banner: Block = {
  slug: 'banner',
  interfaceName: 'BannerBlock',
  labels: { singular: 'Notice', plural: 'Notices' },
  admin: {
    group: 'Content',
    disableBlockName: true,
    images: { icon: '/block-previews/banner.svg', thumbnail: '/block-previews/banner.svg' },
    components: {
      Block: '@/blocks/ArticleBlockEditor#ArticleBlockEditor',
      Label: { path: '@/blocks/BlockRowLabel#BlockRowLabel', clientProps: { blockType: 'banner' } },
    },
  },
  fields: [
    {
      name: 'style',
      label: 'Notice Type',
      admin: {
        description:
          'Highlight a helpful note, warning, error, or success message within the article.',
      },
      type: 'select',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
        { label: 'Success', value: 'success' },
      ],
      defaultValue: 'info',
      required: true,
    },
    { name: 'title', label: 'Notice Title', type: 'text' },
    {
      name: 'content',
      label: 'Notice Content',
      type: 'richText',
      editor: compactLexical,
      required: true,
    },
  ],
}
