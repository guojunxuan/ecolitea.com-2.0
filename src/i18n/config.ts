export type LocaleConfig = {
  code: string
  label: string
  status: 'source' | 'translating' | 'live'
}

export type RegionConfig = {
  code: string
  label: string
  group: string | null
  locale: string
}

export const sourceLocale = 'en'

export const locales: readonly LocaleConfig[] = [{ code: 'en', label: 'English', status: 'source' }]

export const regions: readonly RegionConfig[] = [
  { code: 'GLOBAL', label: 'Global', group: null, locale: 'en' },
]

export const publicLocales = locales.filter(
  ({ status }) => status === 'source' || status === 'live',
)
export const targetLocales = locales.filter(
  ({ status }) => status === 'translating' || status === 'live',
)

// Reserve every language-shaped root slug, including unconfigured locales.
export const isLocaleSegment = (segment: string): boolean =>
  /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)
