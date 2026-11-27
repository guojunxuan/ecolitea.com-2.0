import type { ArrayField } from 'payload'

import { trimText, validateNonBlankText, validateNonBlankTextarea } from './validation'

type CustomFieldsOptions = {
  interfaceName: string
  label: string
  name: string
}

export const customFields = ({ interfaceName, label, name }: CustomFieldsOptions): ArrayField => ({
  name,
  type: 'array',
  label,
  labels: {
    singular: 'Custom Field',
    plural: 'Custom Fields',
  },
  interfaceName,
  maxRows: 20,
  admin: {
    initCollapsed: true,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      hooks: { beforeValidate: [trimText] },
      validate: validateNonBlankText,
    },
    {
      name: 'value',
      type: 'textarea',
      required: true,
      hooks: { beforeValidate: [trimText] },
      validate: validateNonBlankTextarea,
    },
  ],
})
