import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'

export const Banner: Block = {
  slug: 'banner',
  interfaceName: 'BannerBlock',
  labels: { singular: 'Banner', plural: 'Banners' },
  admin: {
    group: 'Content',
    disableBlockName: true,
    images: { icon: '/block-previews/banner.svg', thumbnail: '/block-previews/banner.svg' },
    components: { Label: '@/blocks/BlockRowLabel#BlockRowLabel' },
  },
  fields: [
    {
      name: 'style',
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
    { name: 'title', type: 'text' },
    { name: 'content', type: 'richText', editor: compactLexical, required: true },
  ],
}
