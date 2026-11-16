export { localeCatalog, type LocaleConfig, type RegionConfig } from './catalog'
export const sourceLocale = 'en'
export const isLocaleSegment = (segment: string): boolean =>
  /^[a-z]{2}(?:-[a-z]{2})?$/i.test(segment)
