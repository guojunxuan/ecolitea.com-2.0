import { isLocaleSegment } from './config'
export function stripLocale(path: string): string {
  const first = path.split('/')[1]?.split(/[?#]/)[0]
  if (!first || !isLocaleSegment(first)) return path
  const suffix = path.slice(first.length + 1)
  return !suffix || /^[?#]/.test(suffix) ? `/${suffix}` : suffix
}
export function localePath(path: string, locale = 'en'): string {
  if (!path.startsWith('/') || path.startsWith('//') || /^\/(api|admin|next|_next)(\/|$)/.test(path)) return path
  const source = stripLocale(path)
  return locale === 'en' ? source : `/${locale}${source === '/' ? '' : source}`
}
