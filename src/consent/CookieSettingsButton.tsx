'use client'

import React from 'react'
import { useConsent } from './ConsentProvider'
import { useDictionary } from '@/i18n/DictionaryProvider'
import styles from './CookieSettingsButton.module.css'

export function CookieSettingsButton() {
  const { consent: copy } = useDictionary()
  const { openSettings } = useConsent()
  return (
    <button
      className={styles.button}
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => openSettings(event.currentTarget)}
    >
      {copy.settings}
    </button>
  )
}
