'use client'

import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

type SpecsRow = { label?: string | null; value?: string | null }

export const SpecsRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<SpecsRow>()
  const label = data?.label?.trim()
  const value = data?.value?.trim()
  if (label && value) return <span>{`${label}: ${value}`}</span>
  return <span>{label || value || `Specification ${Number(rowNumber ?? 0) + 1}`}</span>
}
