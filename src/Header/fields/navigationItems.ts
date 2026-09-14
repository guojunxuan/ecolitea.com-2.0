import type { ArrayField } from 'payload'

import { trimText, validateNonBlankText } from '@/fields/linkValidation'
import { CardGroup, CategoryTabs, LinkGroup, RichCard } from '@/Header/blocks'
import {
  HEADER_CONTENT_BLOCKS_MAX,
  HEADER_CONTENT_BLOCKS_MIN,
  HEADER_NAV_ITEMS_MAX,
} from '@/Header/policy'
import { unlabeledNavigationLink } from './links'

export const navigationItems = (): ArrayField => ({
  name: 'navItems',
  type: 'array',
  label: 'Navigation Items',
  labels: { singular: 'Navigation Item', plural: 'Navigation Items' },
  maxRows: HEADER_NAV_ITEMS_MAX,
  interfaceName: 'HeaderNavItem',
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
    {
      name: 'content',
      type: 'blocks',
      label: 'Dropdown Content',
      blocks: [CategoryTabs, CardGroup, LinkGroup, RichCard],
      required: true,
      minRows: HEADER_CONTENT_BLOCKS_MIN,
      maxRows: HEADER_CONTENT_BLOCKS_MAX,
      admin: {
        condition: (_, siblingData) =>
          siblingData?.navigationType === 'dropdown' ||
          siblingData?.navigationType === 'directLinkAndDropdown',
        initCollapsed: true,
      },
    },
  ],
})
