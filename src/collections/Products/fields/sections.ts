import type { ArrayField } from 'payload'
import { productBlocks } from '../blocks'
import { validateSections } from '../hooks/validateSections'

export const productSections: ArrayField = {
  name: 'sections',
  type: 'array',
  maxRows: 8,
  validate: validateSections,
  admin: {
    initCollapsed: true,
    description:
      'Each section becomes a tab in the sticky section nav on the product page, in this order. Sections without blocks are hidden.',
    components: { RowLabel: '@/collections/Products/admin/SectionRowLabel#SectionRowLabel' },
  },
  fields: [
    { name: 'label', type: 'text', required: true, maxLength: 40 },
    { name: 'anchor', type: 'text' },
    { name: 'blocks', type: 'blocks', blocks: productBlocks },
  ],
}
