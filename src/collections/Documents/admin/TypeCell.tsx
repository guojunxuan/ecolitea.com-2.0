import React from 'react'

import { DOCUMENT_UPLOAD_POLICY } from '../uploadPolicy'

const labels: Record<string, string> = Object.fromEntries(
  Object.values(DOCUMENT_UPLOAD_POLICY.types).map(({ mimeType, label }) => [mimeType, label]),
)

export const TypeCell = ({ cellData }: { cellData?: string | null }) => (
  <span>{cellData ? (labels[cellData] ?? cellData) : '—'}</span>
)
