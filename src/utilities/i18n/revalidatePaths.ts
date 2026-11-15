import { revalidatePath } from 'next/cache'
import { publicLocales, type LocaleConfig } from '@/i18n/config'

/** Public English URLs rewrite to /en. Already internal paths stay partitioned,
 * including background retries received by the authenticated Next boundary. */
export function internalLocalePaths(path: string, configured: readonly LocaleConfig[] = publicLocales): string[] {
  if (/^\/(api|admin|next|_next)(\/|$)/.test(path) || /\.[^/]+$/.test(path)) return [path]
  if (configured.some(({ code }) => path === `/${code}` || path.startsWith(`/${code}/`))) return [path]
  return configured.filter(({ status }) => status !== 'translating')
    .map(({ code }) => `/${code}${path === '/' ? '' : path}`)
}
export function revalidateLocalizedPath(...args: Parameters<typeof revalidatePath>) {
  for (const path of internalLocalePaths(args[0])) args[1] ? revalidatePath(path, args[1]) : revalidatePath(path)
}
