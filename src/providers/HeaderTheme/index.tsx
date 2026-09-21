'use client'

import React, { createContext, use, useCallback, useState } from 'react'

export type HeaderTheme = 'light' | 'dark'

interface HeaderThemeContextValue {
  headerTheme: HeaderTheme | null
  setHeaderTheme: (theme: HeaderTheme | null) => void
}

const HeaderThemeContext = createContext<HeaderThemeContextValue>({
  headerTheme: null,
  setHeaderTheme: () => undefined,
})

export const HeaderThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [headerTheme, setThemeState] = useState<HeaderTheme | null>(null)
  const setHeaderTheme = useCallback((theme: HeaderTheme | null) => setThemeState(theme), [])

  return (
    <HeaderThemeContext value={{ headerTheme, setHeaderTheme }}>
      {children}
    </HeaderThemeContext>
  )
}

export const useHeaderTheme = () => use(HeaderThemeContext)
