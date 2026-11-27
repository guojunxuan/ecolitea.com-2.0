import { formatFilesize } from 'payload/shared'
import React from 'react'

export const FilesizeCell = ({ cellData }: { cellData?: number | null }) => (
  <span>{typeof cellData === 'number' ? formatFilesize(cellData) : '—'}</span>
)
