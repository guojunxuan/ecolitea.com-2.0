import type { ArrayField } from 'payload'

import { link } from '@/fields/link'

type NavigationColumnsType = (options: {
  description?: string
  label: string
  maxRows: number
  minRows: number
  name: string
  navItems: {
    maxRows: number
    minRows: number
  }
  rowLabels: {
    column: string
    navItem: string
  }
}) => ArrayField

export const navigationColumns: NavigationColumnsType = ({
  description,
  label,
  maxRows,
  minRows,
  name,
  navItems,
  rowLabels,
}) => ({
  name,
  type: 'array',
  label,
  interfaceName: 'NavigationColumn',
  required: true,
  minRows,
  maxRows,
  admin: {
    description,
    initCollapsed: true,
    components: {
      RowLabel: rowLabels.column,
    },
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      label: 'Column heading',
      required: true,
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'Links',
      required: true,
      minRows: navItems.minRows,
      maxRows: navItems.maxRows,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: rowLabels.navItem,
        },
      },
      fields: [link({ appearances: false })],
    },
  ],
})
