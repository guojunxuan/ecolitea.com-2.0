import type { Tab } from 'payload'

import { customFields } from './customFields'
import { trimText, validateNonBlankText, validateNonBlankTextarea } from './validation'

const visibleWhenNewsletterEnabled = (_data: unknown, siblingData: { enabled?: boolean }) =>
  siblingData.enabled === true

export const contactTab: Tab = {
  label: 'Contact',
  admin: {
    description: 'Company contact details that may be reused across the website.',
  },
  fields: [
    {
      name: 'salesEmail',
      type: 'email',
      label: 'Sales Email',
      required: true,
      hooks: { beforeValidate: [trimText] },
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      hooks: { beforeValidate: [trimText] },
      validate: validateNonBlankText,
      admin: {
        description: 'Include the international dialing code.',
      },
    },
    {
      name: 'address',
      type: 'textarea',
      required: true,
      hooks: { beforeValidate: [trimText] },
      validate: validateNonBlankTextarea,
    },
    {
      name: 'newsletter',
      type: 'group',
      label: 'Newsletter',
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Enable Newsletter',
          defaultValue: true,
        },
        {
          name: 'heading',
          type: 'text',
          required: true,
          defaultValue: 'Stay informed',
          hooks: { beforeValidate: [trimText] },
          validate: validateNonBlankText,
          admin: { condition: visibleWhenNewsletterEnabled },
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          defaultValue: 'Product updates and practical insights.',
          hooks: { beforeValidate: [trimText] },
          validate: validateNonBlankTextarea,
          admin: { condition: visibleWhenNewsletterEnabled },
        },
        {
          name: 'emailPlaceholder',
          type: 'text',
          required: true,
          defaultValue: 'Email address',
          hooks: { beforeValidate: [trimText] },
          validate: validateNonBlankText,
          admin: { hidden: true },
        },
        {
          name: 'buttonLabel',
          type: 'text',
          required: true,
          defaultValue: 'Subscribe',
          hooks: { beforeValidate: [trimText] },
          validate: validateNonBlankText,
          admin: { hidden: true },
        },
      ],
    },
    customFields({
      interfaceName: 'SiteSettingsContactCustomField',
      label: 'Custom Fields',
      name: 'contactCustomFields',
    }),
  ],
}
