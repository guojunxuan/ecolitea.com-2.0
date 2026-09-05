import type { ArrayField } from 'payload'

import { trimText, validateNonBlankText } from '@/fields/linkValidation'
import { validateHeaderNavItems } from '@/Header/validators/validateNavigation'
import { dropdown } from './dropdown'
import { unlabeledNavigationLink } from './links'

export const navigationItems = (): ArrayField => ({
  name: 'navItems',
  type: 'array',
  label: 'Navigation Items',
  labels: { singular: 'Navigation Item', plural: 'Navigation Items' },
  maxRows: 8,
  interfaceName: 'HeaderNavItem',
  validate: validateHeaderNavItems,
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/Header/RowLabel#RowLabel',
    },
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      hooks: { beforeChange: [trimText] },
      validate: validateNonBlankText,
    },
    {
      name: 'navigationType',
      type: 'radio',
      required: true,
      defaultValue: 'directLink',
      admin: { layout: 'horizontal' },
      options: [
        { label: 'Direct Link', value: 'directLink' },
        { label: 'Dropdown', value: 'dropdown' },
        { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
      ],
    },
    unlabeledNavigationLink({
      label: 'Direct Link',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.navigationType === 'directLink' ||
          siblingData?.navigationType === 'directLinkAndDropdown',
      },
    }),
    // Dropdown group — shown for dropdown and directLinkAndDropdown
    dropdown(),
  ],
})
