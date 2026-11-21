'use client'

import { commandPaletteSlug, useModal, useTranslation } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import styles from './Sidebar.module.css'

/**
 * Sidebar entry for Payload's native command palette. The palette itself, its ⌘K / Ctrl+K
 * shortcut and its list of collections and globals belong to Payload. This only opens it.
 */
export function SidebarSearch() {
  const { openModal } = useModal()
  const { t } = useTranslation()
  // The platform is only known in the browser. Render the Mac hint first so hydration matches.
  const [shortcut, setShortcut] = useState('⌘K')

  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('Ctrl K')
  }, [])

  return (
    <button
      type="button"
      className={styles.search}
      aria-label={t('commandPalette:title')}
      aria-haspopup="dialog"
      onClick={() => openModal(commandPaletteSlug)}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </svg>
      <span>Search</span>
      <kbd className={styles.shortcut}>{shortcut}</kbd>
    </button>
  )
}
