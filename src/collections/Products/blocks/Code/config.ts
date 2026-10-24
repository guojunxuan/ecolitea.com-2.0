import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { getProductAspectRatioOptions } from '../shared/aspectRatioOptions'
import { themeField } from '../shared/themeField'

export const Code: Block = {
  slug: 'productCode',
  interfaceName: 'ProductCodeBlock',
  labels: { singular: 'Custom Code', plural: 'Custom Code' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: { icon: '/block-previews/media.svg', thumbnail: '/block-previews/media.svg' },
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
          'Optional inline styles. Use var(--color-foreground) and other tokens for theme-aware colors.',
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
      name: 'heightMode',
      label: 'Height Mode',
      type: 'select',
      options: [
        { label: 'Aspect Ratio', value: 'aspect' },
        { label: 'Fixed Height', value: 'fixed' },
      ],
      defaultValue: 'aspect',
      required: true,
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      options: getProductAspectRatioOptions(['21:9', '16:9', '4:3', '1:1', '4:5']),
      defaultValue: '16:9',
      admin: {
        condition: (_data, siblingData) => siblingData?.heightMode === 'aspect',
      },
    },
    {
      name: 'height',
      label: 'Desktop Height (px)',
      type: 'number',
      defaultValue: 600,
      admin: {
        description: 'Fixed height for desktop viewports.',
        condition: (_data, siblingData) => siblingData?.heightMode === 'fixed',
      },
    },
    {
      name: 'mobileHeight',
      label: 'Mobile Height (px)',
      type: 'number',
      defaultValue: 400,
      admin: {
        description: 'Fixed height for mobile viewports.',
        condition: (_data, siblingData) => siblingData?.heightMode === 'fixed',
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
    { ...themeField },
  ],
}
