export const validGtmId = (value: string | undefined): string | null =>
  value && /^GTM-[A-Z0-9]+$/.test(value) ? value : null

// Called from the client provider; Next inlines this public value at build time.
export const getGtmId = (): string | null =>
  validGtmId(process.env.NEXT_PUBLIC_GTM_MEASUREMENT_ID)

import type { ConsentState } from './types'

type ConsentFlags = Pick<ConsentState, 'analytics' | 'marketing'>
type DataLayer = Array<IArguments | Record<string, unknown>>

declare global {
  interface Window {
    dataLayer?: DataLayer
    gtag?: (...args: unknown[]) => void
  }
}

const initializedLayers = new WeakSet<DataLayer>()

export function ensureConsentDefaults(): void {
  const layer = (window.dataLayer ??= [])
  window.gtag ??= function () {
    // Google's queue consumes the arguments object, matching the gtag bootstrap.
    // eslint-disable-next-line prefer-rest-params -- preserve Google’s gtag queue format
    window.dataLayer!.push(arguments)
  }
  if (initializedLayers.has(layer)) return
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })
  initializedLayers.add(layer)
}

export function updateConsent(state: ConsentFlags): void {
  ensureConsentDefaults()
  window.gtag!('consent', 'update', {
    analytics_storage: state.analytics ? 'granted' : 'denied',
    ad_storage: state.marketing ? 'granted' : 'denied',
    ad_user_data: state.marketing ? 'granted' : 'denied',
    ad_personalization: state.marketing ? 'granted' : 'denied',
  })
}

export function loadGtm(id: string): void {
  if (!validGtmId(id) || document.querySelector('script[data-ecolitea-gtm]')) return
  ensureConsentDefaults()
  window.dataLayer!.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.dataset.ecoliteaGtm = ''
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`
  script.onerror = () => console.warn('Google Tag Manager could not be loaded.')
  document.head.appendChild(script)
}

function clearGoogleCookies(): void {
  const domains = location.hostname.split('.')
  const scopes = ['', `; Domain=${location.hostname}`]
  // Try each parent domain; browsers reject public suffixes and unrelated domains.
  for (let index = 1; index < domains.length - 1; index += 1) {
    scopes.push(`; Domain=${domains.slice(index).join('.')}`)
  }
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.trim().split('=')[0]
    if (!/^(_ga(?:_|$)|_gcl_)/.test(name)) continue
    for (const scope of scopes) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${scope}${location.protocol === 'https:' ? '; Secure' : ''}`
    }
  }
}

export function applyConsent(state: ConsentState | null, id: string | null, disabled: boolean): void {
  const flags = state ?? { analytics: false, marketing: false }
  updateConsent(flags)
  if (!flags.analytics && !flags.marketing) clearGoogleCookies()
  if (id && !disabled && (flags.analytics || flags.marketing)) loadGtm(id)
}
