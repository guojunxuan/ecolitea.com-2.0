import type { LocaleConfig, RegionConfig } from '../../../src/i18n/config'

export const sourceLocale = 'en'
export const locales: readonly LocaleConfig[] = [
  { code: 'en', label: 'English', status: 'source' },
  { code: 'de', label: 'Deutsch', status: 'live' },
  { code: 'fr', label: 'Français', status: 'translating' },
]
export const regions: readonly RegionConfig[] = [
  { code: 'GLOBAL', label: 'Global', group: null, locale: 'en' },
  { code: 'DE', label: 'Deutschland', group: 'Europe', locale: 'de' },
  { code: 'AT', label: 'Österreich', group: 'Europe', locale: 'de' },
  { code: 'FR', label: 'France', group: 'Europe', locale: 'fr' },
]
export const publicLocales = locales.filter(
  ({ status }) => status === 'source' || status === 'live',
)
export const targetLocales = locales.filter(
  ({ status }) => status === 'translating' || status === 'live',
)
export const isLocaleSegment = (segment: string): boolean =>
  /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)
