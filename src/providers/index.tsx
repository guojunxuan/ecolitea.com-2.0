import React from 'react'

import { DictionaryProvider } from '@/i18n/DictionaryProvider'
import type { FrontendDictionary } from '@/i18n/types'
import { ConsentProvider } from '@/consent/ConsentProvider'
import { HeaderThemeProvider } from './HeaderTheme'

export const Providers: React.FC<{
  children: React.ReactNode
  gtmDisabled?: boolean
  gtmContainerId?: string | null
  dictionary?: FrontendDictionary
}> = ({ children, gtmDisabled = false, gtmContainerId = null, dictionary }) => {
  const content = (
    <HeaderThemeProvider>
      <ConsentProvider gtmDisabled={gtmDisabled} gtmContainerId={gtmContainerId}>
        {children}
      </ConsentProvider>
    </HeaderThemeProvider>
  )
  return dictionary ? (
    <DictionaryProvider dictionary={dictionary}>{content}</DictionaryProvider>
  ) : (
    content
  )
}
