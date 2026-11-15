import React from 'react'

import { DictionaryProvider } from '@/i18n/DictionaryProvider'
import type { FrontendDictionary } from '@/i18n/types'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { HeaderThemeProvider } from './HeaderTheme'

export const Providers: React.FC<{
  children: React.ReactNode
  gtmDisabled?: boolean
  dictionary?: FrontendDictionary
}> = ({ children, gtmDisabled = false, dictionary }) => {
  const content = (
    <HeaderThemeProvider>
      <ConsentProvider gtmDisabled={gtmDisabled}>{children}</ConsentProvider>
    </HeaderThemeProvider>
  )
  return dictionary ? (
    <DictionaryProvider dictionary={dictionary}>{content}</DictionaryProvider>
  ) : (
    content
  )
}
