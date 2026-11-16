import { describe, expect, it } from 'vitest'
import { isLocaleSegment, sourceLocale } from '@/i18n/config'
import { parseServerEnv } from '@/utilities/env'

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

describe('translation environment', () => {
  it('defaults to a conservative quota with no credentials or worker', () => {
    expect(parseServerEnv(base)).toMatchObject({
      TRANSLATION_MONTHLY_CHAR_LIMIT: 450000,
      JOBS_AUTORUN: false,
    })
    expect(parseServerEnv(base).GOOGLE_TRANSLATE_API_KEY).toBeUndefined()
    expect(parseServerEnv(base).REVALIDATE_SECRET).toBeUndefined()
  })

  it('parses configured values and trims optional secrets', () => {
    expect(
      parseServerEnv({
        ...base,
        GOOGLE_TRANSLATE_API_KEY: ' key ',
        REVALIDATE_SECRET: ' secret ',
        TRANSLATION_MONTHLY_CHAR_LIMIT: '123',
        JOBS_AUTORUN: 'true',
      }),
    ).toMatchObject({
      GOOGLE_TRANSLATE_API_KEY: 'key',
      REVALIDATE_SECRET: 'secret',
      TRANSLATION_MONTHLY_CHAR_LIMIT: 123,
      JOBS_AUTORUN: true,
    })
  })

  it.each(['false', 'TRUE', '1', 'yes', ''])('does not enable autoRun for %s', (value) => {
    expect(parseServerEnv({ ...base, JOBS_AUTORUN: value }).JOBS_AUTORUN).toBe(false)
  })

  it.each(['0', '-1', '1.5', 'invalid', 'Infinity', '9007199254740992'])(
    'rejects invalid monthly limit %s',
    (value) => {
      expect(() => parseServerEnv({ ...base, TRANSLATION_MONTHLY_CHAR_LIMIT: value })).toThrow(
        'TRANSLATION_MONTHLY_CHAR_LIMIT',
      )
    },
  )
})
