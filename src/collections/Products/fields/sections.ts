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
      'Every section appears in the sticky section nav on the product page, in this order.',
    components: { RowLabel: '@/collections/Products/admin/SectionRowLabel#SectionRowLabel' },
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      maxLength: 40,
      admin: { description: 'Only displayed in the sticky section navigation.' },
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'default',
      required: true,
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Inverse', value: 'inverse' },
      ],
    },
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      type: 'collapsible',
      label: 'Advanced',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'anchor',
          type: 'text',
          admin: {
            description: 'Generated from the label when empty. Keep it stable after publishing.',
          },
        },
      ],
    },
    { name: 'blocks', type: 'blocks', blocks: productBlocks },
  ],
}
