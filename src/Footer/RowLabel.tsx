'use client'

import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

type ColumnRow = {
  label?: string | null
}

type NavItemRow = {
  link?: {
    label?: string | null
  } | null
}

export const ColumnRowLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<ColumnRow>()
  const label = data?.label?.trim()

  return <div>{label || 'Navigation group'}</div>
}

export const NavItemRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NavItemRow>()
  const rowLabel = rowNumber === undefined ? 'Link' : `Link ${rowNumber + 1}`
  const label = data?.link?.label?.trim()

  return <div>{label ? `${rowLabel}: ${label}` : rowLabel}</div>
}
