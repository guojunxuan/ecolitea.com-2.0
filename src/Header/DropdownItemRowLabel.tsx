'use client'

import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

type DropdownRow = {
  type?: 'default' | 'featured' | 'list' | null
  defaultItem?: { link?: { label?: string | null } | null } | null
  featuredItem?: { tag?: string | null } | null
  listItem?: { tag?: string | null } | null
}

const typeLabels: Record<string, string> = {
  default: 'Default',
  featured: 'Featured',
  list: 'List',
}

export const DropdownItemRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<DropdownRow>()
  const num = rowNumber === undefined ? '' : `Item ${rowNumber + 1}`
  const type = data?.type
  const label =
    (data?.defaultItem && data?.defaultItem?.link?.label) ||
    (data?.featuredItem && data?.featuredItem?.tag) ||
    (data?.listItem && data?.listItem?.tag) ||
    ''

  return <div>{label ? `${num}: ${label}` : `${num}: ${type ? (typeLabels[type] ?? type) : 'Row'}`}</div>
}
