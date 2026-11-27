import type { Tab } from 'payload'

import { customFields } from './customFields'
import { trimText, validateNonBlankText, validateNonBlankTextarea } from './validation'

const requiredText = {
  required: true,
  hooks: { beforeValidate: [trimText] },
  validate: validateNonBlankText,
}

export const generalTab: Tab = {
  label: 'General',
  admin: {
    description: 'Core public identity for the website and company.',
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      label: 'Site Name',
      ...requiredText,
    },
    {
      name: 'legalCompanyName',
      type: 'text',
      label: 'Legal Company Name',
      ...requiredText,
    },
    {
      name: 'tagline',
      type: 'text',
      ...requiredText,
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      label: 'Site Description',
      required: true,
      hooks: { beforeValidate: [trimText] },
      validate: validateNonBlankTextarea,
      admin: {
        description: 'Company description used as a fallback when page metadata has no description.',
      },
    },
    customFields({
      interfaceName: 'SiteSettingsCustomField',
      label: 'Custom Fields',
      name: 'customFields',
    }),
  ],
}
