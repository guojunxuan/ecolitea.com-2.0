import en from '@/i18n/dictionaries/en.json'
import type { FrontendDictionary } from '@/i18n/types'
export const consentCopy = en.consent
export type EditableConsentCopy = { bannerTitle?: string | null; bannerDescription?: string | null; settingsDescription?: string | null; necessaryDescription?: string | null; analyticsDescription?: string | null; marketingDescription?: string | null }
export function resolveConsentCopy(value?: EditableConsentCopy | null, fallback: FrontendDictionary['consent'] = consentCopy): FrontendDictionary['consent'] {
  const copy = { ...fallback }
  for (const [field, target] of Object.entries({ bannerTitle: 'title', bannerDescription: 'description', settingsDescription: 'settingsDescription', necessaryDescription: 'necessaryDescription', analyticsDescription: 'analyticsDescription', marketingDescription: 'marketingDescription' } as const)) {
    const text = value?.[field as keyof EditableConsentCopy]
    if (text?.trim()) copy[target] = text
  }
  return copy
}
