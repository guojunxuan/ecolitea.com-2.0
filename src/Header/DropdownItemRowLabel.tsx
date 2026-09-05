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
  const fallback = rowNumber === undefined ? 'Dropdown Item' : `Dropdown Item ${rowNumber + 1}`
  const type = data?.type
  const label =
    type === 'default'
      ? data?.defaultItem?.link?.label?.trim()
      : type === 'featured'
        ? data?.featuredItem?.tag?.trim()
        : type === 'list'
          ? data?.listItem?.tag?.trim()
          : ''
  const typeLabel = type ? (typeLabels[type] ?? type) : ''
  const summary = label ? `${fallback}: ${label}` : fallback

  return <div>{typeLabel ? `${summary} · ${typeLabel}` : summary}</div>
}
