import { describe, expect, it, vi, afterEach } from 'vitest'
import { CONSENT_MAX_AGE, consentCookie, parseConsent, readConsent, serializeConsent, writeConsent, clearPreferences } from '@/consent/cookie'
import { applyGpc, detectGpc } from '@/consent/gpc'

const now = new Date('2026-11-15T00:00:00.000Z')
const state = { analytics: true, marketing: true, decidedAt: now.toISOString() }
afterEach(() => vi.restoreAllMocks())

describe('consent state', () => {
  it('round trips encoded compact JSON and reads the named cookie', () => {
    expect(serializeConsent(state)).toBe(encodeURIComponent(JSON.stringify(state)))
    expect(parseConsent(serializeConsent(state), now)).toEqual(state)
    expect(readConsent(`other=x; ec_consent=${serializeConsent(state)}`, now)).toEqual(state)
  })
  it.each(['%', 'broken', '%7B%7D', encodeURIComponent(JSON.stringify({ ...state, analytics: 'true' })), encodeURIComponent(JSON.stringify({ analytics: false, marketing: false })), encodeURIComponent(JSON.stringify({ ...state, decidedAt: 'bad' }))])('ignores damaged or incomplete values: %s', (value) => {
    expect(parseConsent(value, now)).toBeNull()
  })
  it('expires decisions after 180 days', () => {
    expect(CONSENT_MAX_AGE).toBe(15552000)
    expect(parseConsent(serializeConsent(state), new Date(+now + CONSENT_MAX_AGE * 1000 + 1))).toBeNull()
    expect(readConsent('', now)).toBeNull()
  })
  it('writes host-only cookies with protocol appropriate attributes', () => {
    expect(consentCookie(state, 'http:')).toBe(`ec_consent=${serializeConsent(state)}; Path=/; SameSite=Lax; Max-Age=15552000`)
    expect(consentCookie(state, 'https:')).toBe(`${consentCookie(state, 'http:')}; Secure`)
    const setter = vi.spyOn(document, 'cookie', 'set')
    writeConsent(state)
    expect(setter).toHaveBeenCalledWith(consentCookie(state, location.protocol))
    clearPreferences()
    expect(setter).toHaveBeenLastCalledWith(expect.stringContaining('ec_preferences=; Path=/; SameSite=Lax; Max-Age=0'))
  })
  it('honors GPC without changing analytics or the decision timestamp', () => {
    expect(applyGpc(state, true)).toEqual({ ...state, marketing: false })
    expect(applyGpc(state, false)).toEqual(state)
    expect(applyGpc(null, true)).toBeNull()
    expect(detectGpc({ globalPrivacyControl: true })).toBe(true)
    expect(detectGpc({})).toBe(false)
  })
})
