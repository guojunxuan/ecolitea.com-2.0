import type { ArrayField } from 'payload'

import { trimText, validateNonBlankText } from '@/fields/linkValidation'

import { labeledNavigationLink, unlabeledNavigationLink } from './links'

export { headerLinkTargets } from './links'

const landingLink = () => unlabeledNavigationLink({ name: 'landingLink', label: 'Landing Link' })

export const dropdownItems = (): ArrayField => ({
  name: 'items',
  type: 'array',
  label: 'Dropdown Items',
  labels: { singular: 'Dropdown Item', plural: 'Dropdown Items' },
  required: true,
  minRows: 1,
  maxRows: 12,
  interfaceName: 'HeaderDropdownItem',
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/Header/DropdownItemRowLabel#DropdownItemRowLabel',
    },
  },
  fields: [
    {
      name: 'type',
      type: 'radio',
      required: true,
      defaultValue: 'default',
      admin: { layout: 'horizontal' },
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Featured', value: 'featured' },
        { label: 'List', value: 'list' },
      ],
    },
    {
      name: 'defaultItem',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'default',
      },
      fields: [labeledNavigationLink(), { name: 'description', type: 'textarea' }],
    },
    {
      name: 'featuredItem',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'featured',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          hooks: { beforeChange: [trimText] },
          validate: validateNonBlankText,
        },
        landingLink(),
        { name: 'label', type: 'richText', label: 'Content' },
        {
          name: 'links',
          type: 'array',
          label: 'Navigation Links',
          labels: { singular: 'Navigation Link', plural: 'Navigation Links' },
          maxRows: 4,
          fields: [labeledNavigationLink()],
        },
      ],
    },
    {
      name: 'listItem',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'list',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          hooks: { beforeChange: [trimText] },
          validate: validateNonBlankText,
        },
        landingLink(),
        {
          name: 'links',
          type: 'array',
          label: 'Navigation Links',
          labels: { singular: 'Navigation Link', plural: 'Navigation Links' },
          required: true,
          minRows: 1,
          maxRows: 8,
          fields: [labeledNavigationLink()],
        },
      ],
    },
  ],
})
