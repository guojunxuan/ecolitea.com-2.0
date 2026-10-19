'use client'

import { DefaultCell } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import React from 'react'

export const FilenameCell = (props: DefaultCellComponentProps) => (
  <DefaultCell
    {...props}
    cellData={
      typeof props.cellData === 'string' ? props.cellData.replace(/\.[^.]+$/, '') : props.cellData
    }
  />
)
