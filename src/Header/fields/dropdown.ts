import type { GroupField } from 'payload'

import { link } from '@/fields/link'
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
      label: 'Description links',
      fields: [link({ appearances: false, relationTo: headerLinkTargets })],
    },
    dropdownItems(),
  ],
})
