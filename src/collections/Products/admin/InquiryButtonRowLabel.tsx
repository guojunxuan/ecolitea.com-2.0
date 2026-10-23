'use client'

import { useRowLabel, type RowLabelProps } from '@payloadcms/ui'

export const InquiryButtonRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<{ link?: { label?: string | null } }>()
  return <span>{data?.link?.label?.trim() || `Button ${Number(rowNumber ?? 0) + 1}`}</span>
}
