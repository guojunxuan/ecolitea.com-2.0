import { imageOnly } from '@/collections/mediaUploadPolicy'
import type { Block } from 'payload'
import { compactLexical } from '@/fields/compactLexical'
import { linkGroup } from '@/fields/linkGroup'

export const CallToAction: Block = {
  slug: 'pageCta',
  interfaceName: 'PageCallToActionBlock',
  labels: { singular: 'Action Card', plural: 'Action Cards' },
  admin: {
    group: 'Pages',
    disableBlockName: true,
    images: { icon: '/block-previews/cta.svg', thumbnail: '/block-previews/cta.svg' },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Action Card' },
      },
    },
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      label: 'Card Title',
      required: true,
      admin: {
        description:
          'Guide readers to a product, contact page, or download with a title, description, and links.',
      },
    },
    { name: 'description', type: 'richText', editor: compactLexical },
    {
      name: 'media',
      label: 'Card Media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOnly,
    },
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
