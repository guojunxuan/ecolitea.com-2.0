import React from 'react'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export const UpdatedAtCell = ({ cellData }: { cellData?: string | null }) => {
  const date = cellData ? new Date(cellData) : undefined
  return <span>{date && Number.isFinite(date.getTime()) ? dateFormat.format(date) : '—'}</span>
}
