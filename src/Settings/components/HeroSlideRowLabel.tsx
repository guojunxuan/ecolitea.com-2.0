'use client'
import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

export const HeroSlideRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<{ title?: string }>()
  return (
    <span>
      {data?.title?.trim() || `Slide ${String(Number(rowNumber ?? 0) + 1).padStart(2, '0')}`}
    </span>
  )
}
