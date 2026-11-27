import type { Block } from 'payload'

import { cardLinkField, imageField, titleField } from './fields'

export const RichCard: Block = {
  slug: 'headerRichCard',
  interfaceName: 'HeaderRichCardBlock',
  labels: { singular: 'Rich Card', plural: 'Rich Cards' },
  admin: { group: 'Header' },
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
