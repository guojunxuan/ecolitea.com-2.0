'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { publicLocales } from './config'
import { useDictionary } from './DictionaryProvider'
import { useLocale } from './LocaleProvider'
import styles from './LanguageUnavailableNotice.module.css'

export function LanguageUnavailableNotice() {
  const locale = useLocale()
  const pathname = usePathname()
  const { language: copy } = useDictionary()
  const [show, setShow] = useState(false)
  useEffect(() => {
    const url = new URL(location.href)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(
      url.searchParams.get('unavailable') === locale &&
        (url.pathname === `/${locale}` || url.pathname === '/'),
    )
  }, [locale, pathname])
  const label = publicLocales.find(({ code }) => code === locale)?.label ?? locale
  return show ? (
    <p className={`site-container website-type-body-sm ${styles.notice}`} role="status">
      {copy.unavailable.replace('{language}', label)}
    </p>
  ) : null
}
