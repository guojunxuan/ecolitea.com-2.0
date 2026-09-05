'use client'

import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

type NavRow = {
  label?: string | null
  navigationType?: 'directLink' | 'dropdown' | 'directLinkAndDropdown' | null
  id?: string | null
}

const typeLabels: Record<string, string> = {
  directLink: 'Direct Link',
  dropdown: 'Dropdown',
  directLinkAndDropdown: 'Direct Link + Dropdown',
}

export const RowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NavRow>()
  const fallback = rowNumber === undefined ? 'Navigation Item' : `Navigation Item ${rowNumber + 1}`
  const label = data?.label?.trim()
  const typeLabel = data?.navigationType
    ? (typeLabels[data.navigationType] ?? data.navigationType)
    : ''
  const summary = label ? `${fallback}: ${label}` : fallback

  return <div>{typeLabel ? `${summary} · ${typeLabel}` : summary}</div>
}
