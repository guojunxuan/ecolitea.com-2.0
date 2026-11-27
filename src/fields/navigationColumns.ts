import type { ArrayField, CollectionSlug, TextField } from 'payload'

import deepMerge from '@/utilities/deepMerge'
import { link } from '@/fields/link'

type NavigationColumnsType = (options?: {
  columnLabelOverrides?: Partial<TextField>
  linkLabelOverrides?: Partial<TextField>
  navItemsOverrides?: Partial<ArrayField>
  overrides?: Partial<ArrayField>
  relationTo?: CollectionSlug[]
  urlOverrides?: Partial<TextField>
}) => ArrayField

export const navigationColumns: NavigationColumnsType = ({
  columnLabelOverrides = {},
  linkLabelOverrides = {},
  navItemsOverrides = {},
  overrides = {},
  relationTo,
  urlOverrides = {},
} = {}) => {
  const navItems: ArrayField = deepMerge(
    {
      name: 'navItems',
      type: 'array',
      label: 'Navigation Links',
      labels: {
        singular: 'Navigation Link',
        plural: 'Navigation Links',
      },
      required: true,
      admin: {
        initCollapsed: true,
      },
      fields: [
        link({
          appearances: false,
          labelOverrides: linkLabelOverrides,
          relationTo,
          urlOverrides,
        }),
      ],
    },
    navItemsOverrides,
  )

  const columns: ArrayField = {
    name: 'columns',
    type: 'array',
    label: 'Navigation Columns',
    labels: {
      singular: 'Navigation Column',
      plural: 'Navigation Columns',
    },
    interfaceName: 'NavigationColumns',
    admin: {
      initCollapsed: true,
    },
    fields: [
      deepMerge(
        {
          name: 'label',
          type: 'text',
          label: 'Label',
          required: true,
        },
        columnLabelOverrides,
      ),
      navItems,
    ],
  }

  return deepMerge(columns, overrides)
}
