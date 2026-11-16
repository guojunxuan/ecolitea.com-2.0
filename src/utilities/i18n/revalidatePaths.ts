import { revalidatePath } from 'next/cache'
import { publicLocales, type LocaleConfig } from '@/i18n/config'

/** Public English URLs rewrite to /en. Already internal paths stay partitioned,
 * including background retries received by the authenticated Next boundary. */
export function internalLocalePaths(
  path: string,
  configured: readonly LocaleConfig[] = publicLocales,
): string[] {
  if (/^\/(api|admin|next|_next)(\/|$)/.test(path) || /\.[^/]+$/.test(path)) return [path]
  // Next's implicit cache tags use the physical route pattern for dynamic
  // invalidation; literal /en/[slug] is not the /[lang]/[slug] pattern tag.
  if (path.includes('[')) {
    if (path === '/[lang]' || path.startsWith('/[lang]/')) return [path]
    const prefix = configured.find(
      ({ code }) => path === `/${code}` || path.startsWith(`/${code}/`),
    )
    const source = prefix ? path.slice(prefix.code.length + 1) : path
    return [`/[lang]${source === '/' ? '' : source}`]
  }
  if (configured.some(({ code }) => path === `/${code}` || path.startsWith(`/${code}/`)))
    return [path]
  return configured
    .filter(({ status }) => status !== 'translating')
    .map(({ code }) => `/${code}${path === '/' ? '' : path}`)
}
export function revalidateLocalizedPath(...args: Parameters<typeof revalidatePath>) {
  for (const path of internalLocalePaths(args[0])) {
    if (path.includes('[')) revalidatePath(path, args[1] ?? 'page')
    else if (args[1]) revalidatePath(path, args[1])
    else revalidatePath(path)
  }
}
