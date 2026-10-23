'use client'

import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

type HighlightRow = { text?: string | null }

export const HighlightRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<HighlightRow>()
  return <span>{data?.text?.trim() || `Highlight ${Number(rowNumber ?? 0) + 1}`}</span>
}
