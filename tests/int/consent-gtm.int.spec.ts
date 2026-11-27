import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyConsent,
  ensureConsentDefaults,
  loadGtm,
  updateConsent,
  validGtmId,
} from '@/consent/gtm'

const state = { analytics: true, marketing: false, decidedAt: new Date().toISOString() }
const commands = () => window.dataLayer!.map((entry) => Array.from(entry as ArrayLike<unknown>))
beforeEach(() => {
  vi.useFakeTimers()
  delete window.dataLayer
  delete window.gtag
  document.querySelectorAll('script[data-ecolitea-gtm]').forEach((script) => script.remove())
  for (const cookie of document.cookie.split(';'))
    document.cookie = `${cookie.split('=')[0].trim()}=; Path=/; Max-Age=0`
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('Consent Mode Basic and GTM', () => {
  it('sets denied defaults exactly once before any updates or GTM event', () => {
    ensureConsentDefaults()
    ensureConsentDefaults()
    expect(commands()).toEqual([
      [
        'consent',
        'default',
        {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          wait_for_update: 500,
        },
      ],
    ])
  })
  it('maps analytics and all marketing flags independently', () => {
    updateConsent(state)
    expect(commands().at(-1)).toEqual([
      'consent',
      'update',
      {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ])
    updateConsent({ ...state, analytics: false, marketing: true })
    expect(commands().at(-1)?.[2]).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    })
  })
  it.each([null, { ...state, analytics: false }])(
    'does not load for undecided or rejected consent',
    (consent) => {
      applyConsent(consent, 'GTM-TEST000', false)
      expect(document.querySelector('script[data-ecolitea-gtm]')).toBeNull()
    },
  )
  it('injects one async script and pushes gtm.start after consent defaults and update', () => {
    applyConsent(state, 'GTM-TEST000', false)
    applyConsent(state, 'GTM-TEST000', false)
    loadGtm('GTM-TEST000')
    const scripts = document.querySelectorAll<HTMLScriptElement>('script[data-ecolitea-gtm]')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST000')
    expect(scripts[0].async).toBe(true)
    expect(window.dataLayer![2]).toEqual({ event: 'gtm.js', 'gtm.start': expect.any(Number) })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => scripts[0].dispatchEvent(new Event('error'))).not.toThrow()
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
  it('never injects while disabled or with an invalid ID', () => {
    applyConsent(state, 'GTM-TEST000', true)
    for (const id of ['', 'G-TEST', 'GTM-lowercase', 'GTM-ABC?x=1']) {
      expect(validGtmId(id)).toBeNull()
      applyConsent(state, id, false)
      loadGtm(id)
    }
    expect(document.querySelector('script[data-ecolitea-gtm]')).toBeNull()
  })
  it('revokes consent without reloading the script and deletes controlled Google cookies', () => {
    applyConsent(state, 'GTM-TEST000', false)
    document.cookie = '_ga=one; Path=/'
    document.cookie = '_ga_TEST=two; Path=/'
    document.cookie = '_gcl_au=three; Path=/'
    document.cookie = 'unrelated=keep; Path=/'
    const setter = vi.spyOn(document, 'cookie', 'set')
    applyConsent({ ...state, analytics: false }, 'GTM-TEST000', false)
    expect(document.cookie).toBe('unrelated=keep')
    expect(setter.mock.calls.some(([value]) => value.includes('Domain='))).toBe(true)
    expect(document.querySelectorAll('script[data-ecolitea-gtm]')).toHaveLength(1)
    expect(commands().at(-1)?.[2]).toEqual({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    setter.mockRestore()
  })

  it('clears cookies created by late Google tags after revocation', () => {
    applyConsent(state, 'GTM-TEST000', false)
    applyConsent({ ...state, analytics: false }, 'GTM-TEST000', false)
    document.cookie = 'necessary=keep; Path=/'

    for (const [elapsed, delay] of [
      [500, 500],
      [1000, 1000],
      [4000, 1000],
    ]) {
      vi.advanceTimersByTime(elapsed)
      document.cookie = '_ga_TEST=late; Path=/'
      document.cookie = '_gcl_au=late; Path=/'
      vi.advanceTimersByTime(delay)
      expect(document.cookie).toBe('necessary=keep')
    }
  })

  it.each([
    { analytics: true, marketing: false },
    { analytics: false, marketing: true },
  ])('cancels pending cleanup when permission is granted again: %j', (flags) => {
    applyConsent(null, 'GTM-TEST000', false)
    vi.advanceTimersByTime(500)
    applyConsent({ ...state, ...flags }, 'GTM-TEST000', false)
    expect(vi.getTimerCount()).toBe(0)
    document.cookie = '_ga=permitted; Path=/'
    vi.advanceTimersByTime(10000)
    expect(document.cookie).toContain('_ga=permitted')
  })

  it.each([null, { ...state, analytics: false }])(
    'clears stale cookies on initialization with denied consent: %j',
    (consent) => {
      document.cookie = '_ga=stale; Path=/'
      document.cookie = '_gcl_au=stale; Path=/'
      document.cookie = 'ec_preferences=keep; Path=/'
      applyConsent(consent, 'GTM-TEST000', true)
      expect(document.cookie).toBe('ec_preferences=keep')
      document.cookie = '_ga=late; Path=/'
      vi.advanceTimersByTime(1000)
      expect(document.cookie).toBe('ec_preferences=keep')
    },
  )

  it('does not clear Google cookies when analytics is granted', () => {
    document.cookie = '_ga=permitted; Path=/'
    applyConsent(state, 'GTM-TEST000', false)
    vi.advanceTimersByTime(10000)
    expect(document.cookie).toContain('_ga=permitted')
  })
})
