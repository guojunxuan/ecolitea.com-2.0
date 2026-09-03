import type { ArrayField } from 'payload'

import { link } from '@/fields/link'

const headerLinkTargets = ['pages', 'posts', 'case-studies', 'categories'] as const

export const dropdownItems = (): ArrayField => ({
  name: 'items',
  type: 'array',
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
      type: 'select',
      required: true,
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
      fields: [
        link({ appearances: false, relationTo: [...headerLinkTargets] }),
        { name: 'description', type: 'textarea' },
      ],
    },
    {
      name: 'featuredItem',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'featured',
      },
      fields: [
        { name: 'tag', type: 'text', required: true },
        link({
          appearances: false,
          disableLabel: true,
          relationTo: [...headerLinkTargets],
          overrides: { name: 'landingLink', label: 'Landing Link' },
        }),
        { name: 'label', type: 'richText' },
        {
          name: 'links',
          type: 'array',
          fields: [link({ appearances: false, relationTo: [...headerLinkTargets] })],
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
        { name: 'tag', type: 'text', required: true },
        link({
          appearances: false,
          disableLabel: true,
          relationTo: [...headerLinkTargets],
          overrides: { name: 'landingLink', label: 'Landing Link' },
        }),
        {
          name: 'links',
          type: 'array',
          fields: [link({ appearances: false, relationTo: [...headerLinkTargets] })],
        },
      ],
    },
  ],
})
