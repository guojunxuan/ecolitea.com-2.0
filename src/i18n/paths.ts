import { isLocaleSegment } from './config'
export function stripLocale(path: string): string {
  const first = path.split('/')[1]?.split(/[?#]/)[0]
  if (!first || !isLocaleSegment(first)) return path
  const suffix = path.slice(first.length + 1)
  return !suffix || /^[?#]/.test(suffix) ? `/${suffix}` : suffix
}
export function isLocaleNeutralPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return true
  const pathname = path.split(/[?#]/)[0]
  return /^\/(api|admin|next|_next|fonts|media|brand-assets|block-previews|demos)(\/|$)/.test(pathname) || /\.[^/]+$/.test(pathname)
}
export function localePath(path: string, locale = 'en'): string {
  if (isLocaleNeutralPath(path)) return path
  const source = stripLocale(path)
  if (isLocaleNeutralPath(source)) return source
  return locale === 'en' ? source : `/${locale}${source === '/' ? '' : source}`
}
