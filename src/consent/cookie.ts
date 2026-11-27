import type { ConsentState } from './types'

export const CONSENT_MAX_AGE = 15552000

export const readCookie = (name: string, cookies = document.cookie): string | null => {
  const prefix = `${name}=`
  return cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? null
}

export const serializeConsent = (state: ConsentState): string => encodeURIComponent(JSON.stringify(state))

export function parseConsent(value: string | null, now = new Date()): ConsentState | null {
  if (!value) return null
  try {
    const state: unknown = JSON.parse(decodeURIComponent(value))
    if (!state || typeof state !== 'object' || Array.isArray(state)) return null
    const { analytics, marketing, decidedAt } = state as Record<string, unknown>
    if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean' || typeof decidedAt !== 'string') return null
    const timestamp = Date.parse(decidedAt)
    if (!Number.isFinite(timestamp) || timestamp > +now || +now - timestamp > CONSENT_MAX_AGE * 1000) return null
    return { analytics, marketing, decidedAt }
  } catch {
    return null
  }
}

export const readConsent = (cookies = document.cookie, now = new Date()): ConsentState | null =>
  parseConsent(readCookie('ec_consent', cookies), now)

const attributes = (maxAge: number, protocol: string): string =>
  `Path=/; SameSite=Lax; Max-Age=${maxAge}${protocol === 'https:' ? '; Secure' : ''}`

export const consentCookie = (state: ConsentState, protocol: string): string =>
  `ec_consent=${serializeConsent(state)}; ${attributes(CONSENT_MAX_AGE, protocol)}`

export function writeConsent(state: ConsentState): void {
  document.cookie = consentCookie(state, location.protocol)
}

export function clearPreferences(): void {
  document.cookie = `ec_preferences=; ${attributes(0, location.protocol)}`
}
