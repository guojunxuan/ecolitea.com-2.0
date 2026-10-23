import { ValidationError, type ArrayFieldValidation, type GroupField } from 'payload'
import { array } from 'payload/shared'
import { link } from '@/fields/link'

const validateInquiryButtons: ArrayFieldValidation = (value, options) => {
  const { siblingData, previousValue, event, req } = options
  const inquiry = siblingData as { mode?: string; buttons?: unknown[] | null }
  const incoming = event === 'onChange' ? inquiry.buttons : value
  const rows =
    incoming === undefined ? (Array.isArray(previousValue) ? previousValue : []) : (incoming ?? [])
  const lengthResult = array(rows, options)
  if (lengthResult !== true) return lengthResult
  if (inquiry.mode === 'custom' && !rows.length) {
    const error = { path: 'inquiry.buttons', message: 'Add at least one custom inquiry button.' }
    if (event === 'onChange') return `${error.path}: ${error.message}`
    throw new ValidationError({ collection: 'products', errors: [error], req })
  }
  return true
}

export const productInquiry: GroupField = {
  name: 'inquiry',
  type: 'group',
  fields: [
    {
      name: 'mode',
      type: 'radio',
      defaultValue: 'default',
      options: ['default', 'custom', 'hidden'],
    },
    {
      name: 'buttons',
      type: 'array',
      maxRows: 2,
      validate: validateInquiryButtons,
      admin: {
        condition: (_, siblingData) => siblingData?.mode === 'custom',
        components: {
          RowLabel: '@/collections/Products/admin/InquiryButtonRowLabel#InquiryButtonRowLabel',
        },
      },
      fields: [link({ appearances: ['default', 'outline'] })],
    },
  ],
}
