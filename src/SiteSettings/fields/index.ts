import type { Field, TabsField, UnnamedGroupField } from 'payload'

import { languageFields, regionFields } from './language'
import { brandingTab } from './branding'
import { contactTab } from './contact'
import { generalTab } from './general'
import { legalTab } from './legal'
import { socialTab } from './social'

export { validateAbsoluteHttpURL } from './social'

const group = (label: string, description: string, fields: Field[]): UnnamedGroupField => ({
  type: 'group',
  label,
  admin: { description },
  fields,
})
const named = (fields: Field[], names: string[]) =>
  fields.filter((field) => 'name' in field && names.includes(field.name))
const collapsible = (fields: Field[]): Field => ({
  type: 'collapsible',
  label: 'Custom Fields',
  admin: { initCollapsed: true },
  fields,
})

export const siteSettingsTabs: TabsField = {
  type: 'tabs',
  tabs: [
    {
      label: 'Brand',
      fields: [
        group(
          'Identity',
          'Public identity used throughout the website.',
          named(generalTab.fields, ['siteName', 'tagline', 'siteDescription']),
        ),
        group('Assets', 'Shared brand assets used across the website.', brandingTab.fields),
        group('Custom Fields', 'Additional public details for your brand.', [
          collapsible(named(generalTab.fields, ['customFields'])),
        ]),
      ],
    },
    {
      label: 'Contact & Social',
      fields: [
        group('Contact Details', 'Contact information visitors can use to reach your company.', [
          ...named(contactTab.fields, ['salesEmail', 'phone', 'address']).map((field) =>
            'name' in field && field.name === 'salesEmail' ? { ...field, label: 'Email' } : field,
          ),
          collapsible(named(contactTab.fields, ['contactCustomFields'])),
        ]),
        group('Social Links', 'Public profiles linked from the website.', socialTab.fields),
        group(
          'Newsletter',
          'Subscription copy and availability.',
          named(contactTab.fields, ['newsletter']),
        ),
      ],
    },
    {
      label: 'Legal & Privacy',
      fields: [
        group('Company', 'Legal identity used in website disclosures.', [
          ...named(generalTab.fields, ['legalCompanyName']),
          ...named(legalTab.fields, ['companyRegistrationNumber', 'copyrightText']),
        ]),
        group(
          'Policy Pages',
          'English policy pages linked throughout the website.',
          named(legalTab.fields, ['privacyPolicyPage', 'cookiePolicyPage', 'termsPage']),
        ),
      ],
    },
    {
      label: 'Integrations',
      fields: [
        group('Google Tag Manager', 'Container configuration and emergency controls.', [
          {
            name: 'gtmContainerStatus',
            type: 'ui',
            admin: {
              components: {
                Field: '@/SiteSettings/components/GtmContainerStatus#GtmContainerStatus',
              },
            },
          },
          ...named(legalTab.fields, ['disableGtm']),
        ]),
      ],
    },
    {
      label: 'Language',
      fields: [
        group('Translation Usage', 'Monthly quota and completion of public source content.', [
          {
            name: 'translationStatus',
            type: 'ui',
            admin: {
              components: {
                Field: '@/plugins/translation/admin/TranslationStatus#TranslationStatus',
              },
            },
          },
        ]),
        group('Languages', 'Translation status for each target language.', languageFields),
        group('Regions', 'Visitor locations and their enabled languages.', regionFields),
      ],
    },
  ],
}
