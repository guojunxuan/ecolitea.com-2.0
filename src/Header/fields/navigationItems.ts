import type { ArrayField } from 'payload'

import { link } from '@/fields/link'
import { dropdown } from './dropdown'
import { headerLinkTargets } from './dropdownItems'

export const navigationItems = (): ArrayField => ({
  name: 'navItems',
  type: 'array',
  maxRows: 8,
  interfaceName: 'HeaderNavItem',
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/Header/RowLabel#RowLabel',
    },
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'navigationType',
      type: 'select',
      required: true,
      defaultValue: 'directLink',
      options: [
        { label: 'Direct Link', value: 'directLink' },
        { label: 'Dropdown', value: 'dropdown' },
        { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
      ],
    },
    // Direct Link group — shown for directLink and directLinkAndDropdown
    {
      name: 'link',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.navigationType === 'directLink' ||
          siblingData?.navigationType === 'directLinkAndDropdown',
      },
      fields: [
        link({
          appearances: false,
          disableLabel: true,
          relationTo: headerLinkTargets,
        }),
      ],
    },
    // Dropdown group — shown for dropdown and directLinkAndDropdown
    dropdown(),
  ],
})
