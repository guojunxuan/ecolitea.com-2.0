'use client'

import Link from 'next/link'
import React, { useState } from 'react'

import type { FooterColumnData } from './types'
import styles from './index.module.css'

type FooterNavigationProps = { columns: FooterColumnData[] }

export function FooterNavigation({ columns }: FooterNavigationProps) {
  const [openColumnID, setOpenColumnID] = useState<string | null>(null)

  return (
    <nav aria-label="Footer" className={styles.navigation}>
      {columns.map((column) => {
        const panelID = `footer-column-${column.id}`
        const isOpen = openColumnID === column.id

        return (
          <section className={styles.column} key={column.id}>
            <button
              aria-controls={panelID}
              aria-expanded={isOpen}
              className={styles.accordionTrigger}
              onClick={() => setOpenColumnID(isOpen ? null : column.id)}
              type="button"
            >
              <span>{column.label}</span>
              <span aria-hidden="true" className={styles.accordionIcon}>
                +
              </span>
            </button>
            <h2 className={styles.desktopHeading}>{column.label}</h2>
            <div className={styles.linkPanel} data-open={isOpen ? 'true' : 'false'} id={panelID}>
              <ul className={styles.linkList}>
                {column.navItems.map(({ id, link }) => (
                  <li key={id}>
                    <Link
                      className={styles.navLink}
                      href={link.href}
                      {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )
      })}
    </nav>
  )
}
