import type { GroupField } from 'payload'

import { link } from '@/fields/link'
import { trimText, validateNavigationURL, validateNonBlankText } from '@/fields/linkValidation'
import { dropdownItems, headerLinkTargets } from './dropdownItems'

export const dropdown = (): GroupField => ({
  name: 'dropdown',
  type: 'group',
  admin: {
    condition: (_, siblingData) =>
      siblingData?.navigationType === 'dropdown' ||
      siblingData?.navigationType === 'directLinkAndDropdown',
  },
  fields: [
    { name: 'description', type: 'textarea', label: 'Description' },
    {
      name: 'descriptionLinks',
      type: 'array',
      label: 'Description Links',
      labels: { singular: 'Description Link', plural: 'Description Links' },
      maxRows: 3,
      fields: [
        link({
          appearances: false,
          relationTo: headerLinkTargets,
          typeOverrides: { required: true },
          labelOverrides: {
            hooks: { beforeChange: [trimText] },
            validate: validateNonBlankText,
          },
          urlOverrides: {
            hooks: { beforeChange: [trimText] },
            validate: validateNavigationURL,
          },
        }),
      ],
    },
    dropdownItems(),
  ],
})
