'use client'

import { DefaultCell } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import React from 'react'

// Preserve Payload's folder navigation and selection for assigned folders.
export const FolderCell = (props: DefaultCellComponentProps) =>
  props.cellData === null || props.cellData === undefined || props.cellData === '' ? (
    <span>—</span>
  ) : (
    <DefaultCell {...props} />
  )
