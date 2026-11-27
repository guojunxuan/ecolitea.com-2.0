import { NextResponse, type NextRequest } from 'next/server'
import { localeCatalog, isLocaleSegment, type LocaleConfig } from './i18n/config'

export function routeLocale(
  request: NextRequest,
  configured: readonly Pick<LocaleConfig, 'code'>[] = localeCatalog,
) {
  const first = request.nextUrl.pathname.split('/')[1]
  const locale = configured.find(({ code }) => code === first)
  if (locale) return NextResponse.next()
  if (locale || isLocaleSegment(first))
    return new NextResponse('Unavailable locale', { status: 404 })
  const destination = request.nextUrl.clone()
  destination.pathname = `/en${destination.pathname === '/' ? '' : destination.pathname}`
  return NextResponse.rewrite(destination)
}
export function proxy(request: NextRequest) {
  return routeLocale(request)
}
export const config = {
  matcher: [
    '/((?!api(?:/|$)|admin(?:/|$)|next(?:/|$)|_next(?:/|$)|fonts(?:/|$)|media(?:/|$)|brand-assets(?:/|$)|block-previews(?:/|$)|demos(?:/|$)|.*\\.[^/]+$).*)',
  ],
}
