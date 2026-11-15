import type { TranslationRule } from './index'
import { prefixRule, rowRule } from './shared'
const customFields = rowRule({ label: 'translate', value: 'translate' })
export const siteSettingsRule: TranslationRule = {
  // Brand and legal identity, contact numbers and registration identifiers are shared.
  siteName: 'exclude',
  legalCompanyName: 'exclude',
  phone: 'exclude',
  companyRegistrationNumber: 'exclude',
  tagline: 'translate',
  siteDescription: 'translate',
  address: 'translate',
  copyrightText: 'translate',
  ...prefixRule('customFields[]', customFields),
  ...prefixRule('contactCustomFields[]', customFields),
  ...prefixRule('socialLinks[]', rowRule({ url: 'exclude' })),
  ...prefixRule('newsletter', {
    heading: 'translate',
    description: 'translate',
    emailPlaceholder: 'translate',
    buttonLabel: 'translate',
  }),
}
