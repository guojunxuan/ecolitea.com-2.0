import type { GroupField } from 'payload'

import { dropdownItems } from './dropdownItems'
import { labeledNavigationLink } from './links'

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
      fields: [labeledNavigationLink()],
    },
    dropdownItems(),
  ],
})
