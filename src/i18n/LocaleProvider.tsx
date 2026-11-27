'use client'
import { normalizeI18nSettings, type I18nSettings } from './settings'
import { createContext, useContext, type ReactNode } from 'react'
type LocaleContext = {
  locale: string
  legalPaths: string[]
  englishLabel: string
  i18n: I18nSettings
}
const Context = createContext<LocaleContext>({
  locale: 'en',
  legalPaths: [],
  englishLabel: '(English)',
  i18n: normalizeI18nSettings({}),
})
export function LocaleProvider({
  children,
  locale,
  legalPaths = [],
  englishLabel = '(English)',
  i18n = normalizeI18nSettings({}),
}: Pick<LocaleContext, 'locale'> &
  Partial<Omit<LocaleContext, 'locale'>> & { children: ReactNode }) {
  return (
    <Context.Provider value={{ locale, legalPaths, englishLabel, i18n }}>
      {children}
    </Context.Provider>
  )
}
export const useLocaleContext = () => useContext(Context)
export const useLocale = () => useLocaleContext().locale
