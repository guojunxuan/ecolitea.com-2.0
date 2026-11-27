import { readCookie } from '@/consent/cookie'

export const preferencesCookie = (region: string, protocol: string): string =>
  `ec_preferences=${encodeURIComponent(region)}; Path=/; SameSite=Lax; Max-Age=31536000${protocol === 'https:' ? '; Secure' : ''}`

export function readRegionPreference(cookies = document.cookie): string | null {
  try {
    const value = readCookie('ec_preferences', cookies)
    return value ? decodeURIComponent(value) : null
  } catch {
    return null
  }
}

export function writeRegionPreference(region: string): void {
  document.cookie = preferencesCookie(region, location.protocol)
}
