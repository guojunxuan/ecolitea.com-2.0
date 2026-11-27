'use client'
import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

export const SectionRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<{
    label?: string
    anchor?: string
    blocks?: unknown[]
  }>()
  return (
    <span>
      {data?.label?.trim() || `Section ${Number(rowNumber ?? 0) + 1}`}{' '}
      <small>{`#${data?.anchor ?? ''} · ${data?.blocks?.length ?? 0} blocks`}</small>
    </span>
  )
}
