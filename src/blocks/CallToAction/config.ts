import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'
import { linkGroup } from '@/fields/linkGroup'

export const CallToAction: Block = {
  slug: 'cta',
  interfaceName: 'CallToActionBlock',
  labels: { singular: 'Call to Action', plural: 'Calls to Action' },
  admin: {
    group: 'Conversion',
    disableBlockName: true,
    images: { icon: '/block-previews/cta.svg', thumbnail: '/block-previews/cta.svg' },
    components: { Label: '@/blocks/BlockRowLabel#BlockRowLabel' },
  },
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'description', type: 'richText', editor: compactLexical },
    { name: 'media', type: 'upload', relationTo: 'media' },
    linkGroup({ appearances: ['default', 'outline'], overrides: { maxRows: 2 } }),
    {
      name: 'theme',
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Inverse', value: 'inverse' },
      ],
      admin: { isClearable: true, placeholder: 'Inherit surrounding theme' },
    },
  ],
}
