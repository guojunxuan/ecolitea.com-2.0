import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'

export const Code: Block = {
  slug: 'productCode',
  interfaceName: 'ProductCodeBlock',
  labels: { singular: 'Custom Code', plural: 'Custom Code' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: {
      icon: '/block-previews/product-code.svg',
      thumbnail: '/block-previews/product-code.svg',
    },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Custom Code' },
      },
    },
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: 80,
      admin: {
        description: 'Identifies this block in the Admin list. Not shown on the live site.',
      },
    },
    { name: 'title', type: 'text', maxLength: 80 },
    {
      name: 'html',
      type: 'code',
      required: true,
      admin: {
        language: 'html',
        description:
          'Custom HTML content. Use {{asset:0}}, {{asset:1}}, etc. to reference assets below.',
      },
    },
    {
      name: 'css',
      type: 'code',
      admin: {
        language: 'css',
        description:
          'Use --website-* tokens and .website-type-* classes. Legacy --color-* aliases remain supported.',
      },
    },
    {
      name: 'js',
      type: 'code',
      admin: {
        language: 'javascript',
        description:
          'Optional inline script. Runs in a sandboxed iframe; cannot access the parent window.',
      },
    },
    {
      name: 'assets',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      filterOptions: imageOrVideo,
      admin: {
        description:
          'Uploaded media for use in your HTML/CSS/JS. Reference them with {{asset:0}}, {{asset:1}}, etc.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'minHeight',
          type: 'number',
          required: true,
          defaultValue: 240,
          min: 100,
          max: 2000,
          admin: {
            description: 'Placeholder height in px until the content reports its real height.',
          },
        },
        {
          name: 'width',
          type: 'select',
          options: [
            { label: 'Standard', value: 'standard' },
            { label: 'Full Width', value: 'full' },
          ],
          defaultValue: 'standard',
          required: true,
        },
      ],
    },
  ],
}
