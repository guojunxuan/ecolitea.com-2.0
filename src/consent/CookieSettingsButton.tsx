'use client'

import React from 'react'
import { useConsent } from './ConsentProvider'
import { consentCopy } from './copy'
import styles from './CookieSettingsButton.module.css'

export function CookieSettingsButton() {
  const { openSettings } = useConsent()
  return (
    <button
      className={styles.button}
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openSettings(event.currentTarget)}
    >
      {consentCopy.settings}
    </button>
  )
}
