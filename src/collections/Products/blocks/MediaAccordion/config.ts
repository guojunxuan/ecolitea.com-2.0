import type { Block } from 'payload'

import { imageOrVideo } from '@/collections/mediaUploadPolicy'
import { compactLexical } from '@/fields/compactLexical'
import { productAspectRatioField } from '../shared/aspectRatio'
import { playbackField } from '../shared/playbackField'
import { themeField } from '../shared/themeField'

export const MediaAccordion: Block = {
  slug: 'productMediaAccordion',
  interfaceName: 'ProductMediaAccordionBlock',
  labels: { singular: 'Media Accordion', plural: 'Media Accordions' },
  admin: {
    group: 'Products',
    disableBlockName: true,
    images: {
      icon: '/block-previews/product-media-accordion.svg',
      thumbnail: '/block-previews/product-media-accordion.svg',
    },
    components: {
      Label: {
        path: '@/blocks/BlockRowLabel#BlockRowLabel',
        clientProps: { label: 'Media Accordion' },
      },
    },
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      maxLength: 40,
      admin: {
        description: 'An accordion with optional item media and a shared default image or video.',
      },
    },
    { name: 'title', type: 'text', maxLength: 80 },
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      admin: { initCollapsed: true },
      fields: [
        { name: 'title', type: 'text', required: true, maxLength: 80 },
        { name: 'body', type: 'richText', editor: compactLexical },
        { name: 'media', type: 'upload', relationTo: 'media', filterOptions: imageOrVideo },
        playbackField,
      ],
    },
    {
      name: 'defaultMedia',
      label: 'Default Media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: imageOrVideo,
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'mediaPosition',
          label: 'Media Position',
          type: 'select',
          options: [
            { label: 'Right', value: 'right' },
            { label: 'Left', value: 'left' },
          ],
          defaultValue: 'right',
          required: true,
        },
        productAspectRatioField({ values: ['4:5', '1:1', '4:3'], defaultValue: '1:1' }),
        themeField,
      ],
    },
  ],
}
