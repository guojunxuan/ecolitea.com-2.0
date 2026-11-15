import React from 'react'

import { ConsentProvider } from '@/consent/ConsentProvider'

import { HeaderThemeProvider } from './HeaderTheme'

export const Providers: React.FC<{
  children: React.ReactNode
  gtmDisabled: boolean
}> = ({ children, gtmDisabled }) => {
  return <HeaderThemeProvider><ConsentProvider gtmDisabled={gtmDisabled}>{children}</ConsentProvider></HeaderThemeProvider>
}
