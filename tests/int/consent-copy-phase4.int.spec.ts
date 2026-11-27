import { expect, it } from 'vitest'
import { consentCopy, resolveConsentCopy } from '@/consent/copy'
import { siteSettingsRule } from '@/plugins/translation/rules/siteSettings'
it('uses editable consent copy with dictionary fallback for empty values', () => {
  expect(
    resolveConsentCopy({
      bannerTitle: 'Our cookies',
      bannerDescription: ' ',
      analyticsDescription: 'Usage statistics',
    }),
  ).toMatchObject({
    title: 'Our cookies',
    description: consentCopy.description,
    analyticsDescription: 'Usage statistics',
    accept: consentCopy.accept,
  })
})
it('declares all editable copy as translatable', () => {
  for (const name of [
    'bannerTitle',
    'bannerDescription',
    'settingsDescription',
    'necessaryDescription',
    'analyticsDescription',
    'marketingDescription',
  ])
    expect(siteSettingsRule[`cookieConsent.${name}`]).toBe('translate')
})
