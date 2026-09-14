import type { Block } from 'payload'

import { cardItemFields } from './fields'

export const RichCard: Block = {
  slug: 'richCard',
  interfaceName: 'HeaderRichCardBlock',
  labels: { singular: 'Rich Card', plural: 'Rich Cards' },
  fields: [
    ...cardItemFields().slice(0, 2),
    {
      name: 'description',
      type: 'textarea',
    },
    cardItemFields()[2],
  ],
}
