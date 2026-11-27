'use client'

import { RenderDefaultCell } from '@payloadcms/ui'
import type { DefaultCellComponentProps } from 'payload'
import React from 'react'

export const FilenameCell = (props: DefaultCellComponentProps) => (
  <RenderDefaultCell
    clientProps={{
      ...props,
      cellData:
        typeof props.cellData === 'string'
          ? props.cellData.replace(/\.[^.]+$/, '')
          : props.cellData,
    }}
    columnIndex={props.columnIndex ?? 0}
    isLinkedColumn={props.link === true}
  />
)
