import { afterEach, describe, expect, it, vi } from 'vitest'
import { isLocaleSegment, sourceLocale } from '@/i18n/config'
import { getTurnstileSiteKey, parseServerEnv } from '@/utilities/env'

import { normalizeI18nSettings } from '@/i18n/settings'
const defaults = normalizeI18nSettings({})
const locales = defaults.publicLocales.map(({ code, label, status }) => ({ code, label, status }))
const publicLocales = locales
const targetLocales = defaults.targetLocales.map(({ code, label, status }) => ({
  code,
  label,
  status,
}))
const regions = defaults.regions

const base = {
  DATABASE_URI: 'mongodb://127.0.0.1:27017/ecolitea2-test-phase4-env',
  PAYLOAD_SECRET: 'phase2-test-secret',
  NEXT_PUBLIC_SERVER_URL: 'https://server.example.invalid',
  CRON_SECRET: 'phase2-test-cron',
  PREVIEW_SECRET: 'phase2-test-preview',
  R2_BUCKET: 'phase2-test-bucket',
  R2_ACCESS_KEY_ID: 'phase2-test-access',
  R2_SECRET_ACCESS_KEY: 'phase2-test-secret',
  R2_ENDPOINT: 'https://storage.example.invalid',
  R2_PUBLIC_URL: 'https://media.example.invalid',
}

describe('language configuration', () => {
  it('defaults to English and Global and derives public and translation targets from status', () => {
    expect(sourceLocale).toBe('en')
    expect(locales).toEqual([{ code: 'en', label: 'English', status: 'source' }])
    expect(regions).toEqual([{ code: 'GLOBAL', label: 'Global', group: null, locale: 'en' }])
    expect(publicLocales).toEqual(
      locales.filter(({ status }) => status === 'source' || status === 'live'),
    )
    expect(targetLocales).toEqual(
      locales.filter(({ status }) => status === 'translating' || status === 'live'),
    )
    expect(targetLocales).toEqual([])
  })

  it.each(['en', 'de', 'xx', 'pt-br', 'EN', 'en-US'])(
    'reserves the language segment %s',
    (segment) => {
      expect(isLocaleSegment(segment)).toBe(true)
    },
  )

  it.each(['e', 'eng', 'en-usa', 'en1', '/en', 'en/', 'en_us', ' en', '12', ''])(
    'rejects %s as a language segment',
    (segment) => {
      expect(isLocaleSegment(segment)).toBe(false)
    },
  )
})

describe('server environment', () => {
  it('keeps integration settings out of the deployment environment model', () => {
    expect(parseServerEnv(base)).toEqual({ ...base, JOBS_AUTORUN: false })
  })

  it('parses worker topology and trims optional secrets', () => {
    expect(
      parseServerEnv({
        ...base,
        REVALIDATE_SECRET: ' secret ',
        TURNSTILE_SECRET_KEY: ' turnstile-secret ',
        QUOTE_IP_HASH_SALT: ' ip-salt ',
        JOBS_AUTORUN: 'true',
      }),
    ).toEqual({
      ...base,
      REVALIDATE_SECRET: 'secret',
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
      QUOTE_IP_HASH_SALT: 'ip-salt',
      JOBS_AUTORUN: true,
    })
  })

  it.each(['false', 'TRUE', '1', 'yes', ''])('does not enable autoRun for %s', (value) => {
    expect(parseServerEnv({ ...base, JOBS_AUTORUN: value }).JOBS_AUTORUN).toBe(false)
  })

  it('keeps required configuration strict and normalizes public origins', () => {
    expect(() => parseServerEnv({ ...base, PAYLOAD_SECRET: ' ' })).toThrow(
      'Missing required environment variable: PAYLOAD_SECRET',
    )
    expect(
      parseServerEnv({
        ...base,
        NEXT_PUBLIC_SERVER_URL: ' https://site.example.invalid/// ',
        R2_PUBLIC_URL: ' https://media.example.invalid/// ',
      }),
    ).toMatchObject({
      NEXT_PUBLIC_SERVER_URL: 'https://site.example.invalid',
      R2_PUBLIC_URL: 'https://media.example.invalid',
    })
  })
})

describe('runtime public environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the current public Turnstile site key on every call without reimporting', () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', ' first-deployment-key ')
    expect(getTurnstileSiteKey()).toBe('first-deployment-key')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'second-deployment-key')
    expect(getTurnstileSiteKey()).toBe('second-deployment-key')
  })

  it.each([undefined, '', ' \t '])('treats an unconfigured key (%s) as unavailable', (key) => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', key)
    expect(getTurnstileSiteKey()).toBeUndefined()
  })
})
