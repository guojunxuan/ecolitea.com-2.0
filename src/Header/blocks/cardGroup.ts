import type { Block } from 'payload'

import {
  cardItemsField,
  ctaField,
  enableCtaField,
  enableHeadingField,
  headingField,
} from './fields'

export const CardGroup: Block = {
  slug: 'cardGroup',
  interfaceName: 'HeaderCardGroupBlock',
  labels: { singular: 'Card Group', plural: 'Card Groups' },
  fields: [enableHeadingField(), headingField(), enableCtaField(), ctaField(), cardItemsField()],
}
