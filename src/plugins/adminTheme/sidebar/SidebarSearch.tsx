'use client'

import { commandPaletteSlug, useModal, useTranslation } from '@payloadcms/ui'
import { useSyncExternalStore } from 'react'
import styles from './Sidebar.module.css'

// The platform never changes while the page is open, so there is nothing to subscribe to.
const subscribe = () => () => {}
const clientShortcut = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K')
// The server cannot know the platform. It renders the Mac hint, and React corrects it after hydration.
const serverShortcut = () => '⌘K'

/**
 * Sidebar entry for Payload's native command palette. The palette itself, its ⌘K / Ctrl+K
 * shortcut and its list of collections and globals belong to Payload. This only opens it.
 */
export function SidebarSearch() {
  const { openModal } = useModal()
  const { t } = useTranslation()
  const shortcut = useSyncExternalStore(subscribe, clientShortcut, serverShortcut)

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
