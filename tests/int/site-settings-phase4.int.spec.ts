import { describe, expect, it } from 'vitest'
import type { Field } from 'payload'
import { siteSettingsTabs } from '@/SiteSettings/fields'

function paths(fields: Field[], prefix = ''): string[] {
  return fields.flatMap((field) => {
    if (field.type === 'ui') return []
    if (field.type === 'tabs') return field.tabs.flatMap((tab) => paths(tab.fields, prefix))
    const path = 'name' in field && field.name ? `${prefix}${field.name}` : ''
    const children = 'fields' in field ? paths(field.fields, path ? `${path}.` : prefix) : []
    return [...(path ? [path] : []), ...children]
  })
}

describe('Phase 4 Site Settings presentation', () => {
  it('groups five unnamed tabs using only unnamed presentation groups', () => {
    expect(siteSettingsTabs.tabs.map(({ label }) => label)).toEqual([
      'Brand', 'Contact & Social', 'Legal & Privacy', 'Integrations', 'Language',
    ])
    for (const tab of siteSettingsTabs.tabs) {
      expect(tab).not.toHaveProperty('name')
      for (const field of tab.fields) {
        expect(field.type).toBe('group')
        expect(field).not.toHaveProperty('name')
        expect(field.admin?.description).toBeTruthy()
      }
    }
  })

  it('preserves every persisted field path without a migration', () => {
    expect(paths([siteSettingsTabs]).sort()).toEqual([
      'siteName', 'legalCompanyName', 'tagline', 'siteDescription',
      'customFields', 'customFields.label', 'customFields.value', 'logo', 'favicon',
      'salesEmail', 'phone', 'address', 'newsletter', 'newsletter.enabled',
      'newsletter.heading', 'newsletter.description', 'newsletter.emailPlaceholder',
      'newsletter.buttonLabel', 'contactCustomFields', 'contactCustomFields.label',
      'contactCustomFields.value', 'socialLinks', 'socialLinks.platform', 'socialLinks.url',
      'copyrightText', 'companyRegistrationNumber', 'privacyPolicyPage', 'cookiePolicyPage',
      'termsPage', 'disableGtm',
    ].sort())
  })
})
