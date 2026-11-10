'use client'

import { EditIcon, Link, Table } from '@payloadcms/ui'
import type { Column } from 'payload'
import React from 'react'
import styles from './UsedInTable.module.css'

type UsageRow = {
  title: string
  type: string
  editURL: string
}

export function UsedInTable({ rows }: { rows: UsageRow[] }) {
  const columns: Column[] = [
    {
      accessor: 'title',
      active: true,
      field: { name: 'title', type: 'text' },
      Heading: 'Title',
      isLinkedColumn: true,
      renderedCells: rows.map((row) => (
        <Link className={styles.link} href={row.editURL} key={row.editURL}>
          <span className={styles.title}>{row.title}</span>
          <span className={styles.icon} aria-hidden="true">
            <EditIcon />
          </span>
        </Link>
      )),
    },
    {
      accessor: 'type',
      active: true,
      field: { name: 'type', type: 'text' },
      Heading: 'Type',
      renderedCells: rows.map((row) => <span key={row.editURL}>{row.type}</span>),
    },
  ]

  return (
    <div className={styles.table}>
      <Table appearance="condensed" columns={columns} data={rows} />
    </div>
  )
}
