'use client'
import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'
export const OptionRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<{ name?: string; display?: string; values?: unknown[] }>()
  return (
    <span>
      {data?.name?.trim() || `Option ${Number(rowNumber ?? 0) + 1}`}{' '}
      <small>{`${data?.display || 'text'} · ${data?.values?.length ?? 0} values`}</small>
    </span>
  )
}
