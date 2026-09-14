import type { Block } from 'payload'

import { cardLinkField, imageField, titleField } from './fields'

export const RichCard: Block = {
  slug: 'richCard',
  interfaceName: 'HeaderRichCardBlock',
  labels: { singular: 'Rich Card', plural: 'Rich Cards' },
  fields: [
    imageField(),
    titleField(),
    {
      name: 'description',
      type: 'textarea',
    },
    cardLinkField(),
  ],
}
