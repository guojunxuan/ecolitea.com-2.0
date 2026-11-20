'use client'

import { useRootTheme } from '@payloadcms/ui'
import { useEffect } from 'react'

export function AnonymousThemeSync() {
  const { setTheme } = useRootTheme()

  useEffect(() => {
    // The anonymous client config omits admin.theme, disabling the root provider's auto-theme initialization.
    setTheme('auto')
  }, [setTheme])

  return null
}
