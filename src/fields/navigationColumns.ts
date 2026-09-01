import type { ArrayField } from 'payload'

import deepMerge from '@/utilities/deepMerge'
import { link } from '@/fields/link'

type NavigationColumnsType = (options?: {
  navItemsOverrides?: Partial<ArrayField>
  overrides?: Partial<ArrayField>
}) => ArrayField

export const navigationColumns: NavigationColumnsType = ({
  navItemsOverrides = {},
  overrides = {},
} = {}) => {
  const navItems: ArrayField = deepMerge(
    {
      name: 'navItems',
      type: 'array',
      label: 'Links',
      required: true,
      admin: {
        initCollapsed: true,
      },
      fields: [link({ appearances: false })],
    },
    navItemsOverrides,
  )

  const columns: ArrayField = {
    name: 'columns',
    type: 'array',
    label: 'Navigation columns',
    interfaceName: 'NavigationColumn',
    required: true,
    admin: {
      initCollapsed: true,
    },
    fields: [
      {
        name: 'label',
        type: 'text',
        label: 'Column heading',
        required: true,
      },
      navItems,
    ],
  }

  return deepMerge(columns, overrides)
}
