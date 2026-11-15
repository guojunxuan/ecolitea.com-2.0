'use client'
import { createContext, useContext, type ReactNode } from 'react'
type LocaleContext = { locale: string; legalPaths: string[]; englishLabel: string }
const Context = createContext<LocaleContext>({ locale: 'en', legalPaths: [], englishLabel: '(English)' })
export function LocaleProvider({ children, locale, legalPaths = [], englishLabel = '(English)' }: Pick<LocaleContext, 'locale'> & Partial<Omit<LocaleContext, 'locale'>> & { children: ReactNode }) {
  return <Context.Provider value={{ locale, legalPaths, englishLabel }}>{children}</Context.Provider>
}
export const useLocaleContext = () => useContext(Context)
export const useLocale = () => useLocaleContext().locale
