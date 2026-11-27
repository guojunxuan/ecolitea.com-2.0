'use client'

import { useLayoutEffect } from 'react'

import type { HeaderTheme } from '@/providers/HeaderTheme'
import { useHeaderTheme } from '@/providers/HeaderTheme'

export const HeaderThemeSync = ({ theme }: { theme?: HeaderTheme | null }) => {
  const { setHeaderTheme } = useHeaderTheme()

  useLayoutEffect(() => {
    setHeaderTheme(theme ?? null)

    return () => setHeaderTheme(null)
  }, [setHeaderTheme, theme])

  return <span aria-hidden="true" data-header-theme={theme ?? 'light'} hidden />
}
