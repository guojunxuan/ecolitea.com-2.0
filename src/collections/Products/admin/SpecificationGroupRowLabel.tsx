'use client'

import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

type SpecificationGroup = { group?: string | null; items?: unknown[] | null }

export const SpecificationGroupRowLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<SpecificationGroup>()
  const count = data?.items?.length ?? 0
  return (
    <span>{data?.group?.trim() || `Ungrouped · ${count} ${count === 1 ? 'row' : 'rows'}`}</span>
  )
}
