import { permanentRedirect, redirect } from 'next/navigation'
import { getCachedSiteSettings } from '../getGlobals'

export async function legalPagePaths(): Promise<string[]> {
  const settings = await getCachedSiteSettings()
  return [settings.privacyPolicyPage, settings.cookiePolicyPage, settings.termsPage]
    .flatMap((page) => page && typeof page === 'object' && page.slug ? [`/${page.slug}`] : [])
}
export async function enforceLegalLocale(englishPath: string, locale: string) {
  // Approved Phase 3 deviation: Next page APIs expose 308 (permanent) and 307
  // (temporary). Static /en normalization separately retains statusCode: 301.
  if (locale !== 'en' && (await legalPagePaths()).includes(englishPath)) permanentRedirect(englishPath)
}
export async function fallbackToEnglish<T>(localized: T | null, locale: string, englishPath: string, readEnglish: () => Promise<unknown>): Promise<T | null> {
  if (!localized && locale !== 'en' && await readEnglish()) redirect(englishPath)
  return localized
}
