'use client'

import { RowLabelProps, useRowLabel } from '@payloadcms/ui'
import { getColumnRowLabel, getNavItemRowLabel } from './rowLabels'

export const ColumnRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel()

  return <div>{getColumnRowLabel(data as Parameters<typeof getColumnRowLabel>[0], rowNumber)}</div>
}

export const NavItemRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel()

  return (
    <div>{getNavItemRowLabel(data as Parameters<typeof getNavItemRowLabel>[0], rowNumber)}</div>
  )
}
