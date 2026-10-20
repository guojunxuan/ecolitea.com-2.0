import React from 'react'

const labels: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/avif': 'AVIF',
  'image/gif': 'GIF',
  'video/mp4': 'MP4',
}

export const TypeCell = ({ cellData }: { cellData?: string | null }) => (
  <span>{cellData ? (labels[cellData] ?? cellData) : '—'}</span>
)
