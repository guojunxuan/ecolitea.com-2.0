import React from 'react'

export const DimensionsCell = ({
  cellData,
  rowData,
}: {
  cellData?: number | null
  rowData: { height?: number | null; mimeType?: string | null; durationSeconds?: number | null }
}) => {
  const duration = rowData.durationSeconds
  const seconds =
    typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? Math.floor(duration)
      : undefined
  const time =
    rowData.mimeType === 'video/mp4' && seconds !== undefined
      ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
      : ''
  return <span>{cellData && rowData.height ? `${cellData} × ${rowData.height}${time}` : '—'}</span>
}
