'use client'

import { useTheme } from '@payloadcms/ui'
import { useEffect } from 'react'

export function AnonymousThemeSync() {
  const { setTheme } = useTheme()

  useEffect(() => {
    // The anonymous canary client config omits admin.theme, disabling its auto-theme initialization.
    setTheme('auto')
  }, [setTheme])

  return null
}
