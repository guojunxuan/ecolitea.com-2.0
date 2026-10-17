import React from 'react'

export const DimensionsCell = ({
  cellData,
  rowData,
}: {
  cellData?: number | null
  rowData: { height?: number | null }
}) => <span>{cellData && rowData.height ? `${cellData} × ${rowData.height}` : '—'}</span>
