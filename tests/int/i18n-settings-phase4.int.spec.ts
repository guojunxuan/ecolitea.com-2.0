import { describe, expect, it } from 'vitest'
import { normalizeI18nSettings, validateLanguages, validateRegions } from '@/i18n/settings'

describe('Site Settings locale configuration', () => {
  it('defaults to English with Global and no targets', () => {
    const settings = normalizeI18nSettings({})
    expect(settings.publicLocales.map(({ code }) => code)).toEqual(['en'])
    expect(settings.targetLocales).toEqual([])
    expect(settings.regions).toEqual([
      { code: 'GLOBAL', label: 'Global', group: null, locale: 'en' },
    ])
  })
  it('keeps translating targets private and off regions hidden without deleting input', () => {
    const input = {
      languages: [
        { code: 'de', status: 'live' },
        { code: 'fr', status: 'translating' },
        { code: 'zh', status: 'off' },
      ],
      regions: [
        { id: 'de', label: 'Deutschland', group: 'Europe', locale: 'de' },
        { id: 'fr', label: 'France', locale: 'fr' },
      ],
    }
    expect(normalizeI18nSettings(input).publicLocales.map(({ code }) => code)).toEqual(['en', 'de'])
    expect(normalizeI18nSettings(input).targetLocales.map(({ code }) => code)).toEqual(['de', 'fr'])
    expect(normalizeI18nSettings(input).regions.map(({ code }) => code)).toEqual(['GLOBAL', 'de'])
    expect(input.regions).toHaveLength(2)
  })
  it('rejects duplicate languages, source-language entries and invalid regions', () => {
    expect(
      validateLanguages([
        { code: 'de', status: 'live' },
        { code: 'de', status: 'off' },
      ]),
    ).not.toBe(true)
    expect(validateLanguages([{ code: 'en', status: 'live' }])).not.toBe(true)
    expect(
      validateRegions(
        [
          { label: 'Global', locale: 'en' },
          { label: 'France', locale: 'fr' },
        ],
        [],
      ),
    ).not.toBe(true)
    expect(
      validateRegions([{ label: 'Deutschland', locale: 'de' }], [{ code: 'de', status: 'live' }]),
    ).not.toBe(true)
    expect(validateRegions([], [])).toBe(true)
  })
})
