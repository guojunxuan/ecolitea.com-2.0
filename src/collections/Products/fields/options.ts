import type { ArrayField, Condition } from 'payload'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import { validateOptions } from '../hooks/validateOptions'

const displayIs =
  (display: string): Condition =>
  (data, _siblingData, { path }) => {
    const index = Number(path[path.indexOf('options') + 1])
    return data.options?.[index]?.display === display
  }

export const productOptions: ArrayField = {
  name: 'options',
  type: 'array',
  validate: validateOptions,
  admin: {
    initCollapsed: true,
    description:
      'Options are generic: name each group freely (Color, Size, Capacity, Finish…). Each value can show one image in the product gallery and override specifications. No SKU or stock.',
    components: { RowLabel: '@/collections/Products/admin/OptionRowLabel#OptionRowLabel' },
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 40 },
    {
      name: 'display',
      type: 'select',
      options: ['text', 'swatch', 'image'],
      required: true,
      defaultValue: 'text',
    },
    {
      name: 'values',
      type: 'array',
      required: true,
      minRows: 1,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/collections/Products/admin/OptionValueRowLabel#OptionValueRowLabel',
        },
      },
      fields: [
        { name: 'label', type: 'text', required: true, maxLength: 40 },
        { name: 'swatch', type: 'text', admin: { condition: displayIs('swatch') } },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOnly,
          admin: {
            description:
              'Shown in the product gallery when this value is selected. Also used as the thumbnail when the group displays images.',
          },
        },
        {
          name: 'specifications',
          type: 'array',
          admin: {
            components: {
              RowLabel: '@/collections/Products/admin/SpecificationRowLabel#SpecificationRowLabel',
            },
          },
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'value', type: 'text', required: true },
          ],
        },
      ],
    },
  ],
}
