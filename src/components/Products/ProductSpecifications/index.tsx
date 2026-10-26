'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useProductSelection } from '../ProductSelection'
import styles from './index.module.css'

export function ProductSpecifications({ compact = false }: { compact?: boolean }) {
  const { specifications, changed, revision } = useProductSelection()
  const [expanded, setExpanded] = useState(false)
  if (!specifications.length) return null
  const rows = compact
    ? specifications.slice(0, 4)
    : expanded
      ? specifications
      : specifications.slice(0, 12)
  const list = (
    <dl className={compact ? styles.key : styles.list}>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}-${changed.includes(row.label) ? revision : 0}`}
          className={changed.includes(row.label) ? styles.changed : undefined}
        >
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
  if (compact)
    return (
      <div className={styles.summary}>
        {list}
        <a className={styles.all} href="#specifications">
          View all specifications
        </a>
      </div>
    )
  return (
    <section id="specifications" className={styles.root}>
      <h2 className={styles.heading}>Specifications</h2>
      {list}
      {specifications.length > 12 && (
        <div className={styles.toggle}>
          <Button
            variant="outline"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show fewer specifications' : 'Show all specifications'}
          </Button>
        </div>
      )}
    </section>
  )
}
