import { ValidationError, type GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

import { validateLanguages, validateRegions } from '@/i18n/settings'
import { protectIntegrationSecrets } from './fields/integrations'
import { siteSettingsTabs } from './fields'
import { revalidateSiteSettings } from './hooks/revalidateSiteSettings'
import { createTestEmailEndpoint } from '@/plugins/email/endpoint'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  typescript: {
    interface: 'SiteSettings',
  },
  admin: { group: 'Site' },
  access: {
    read: anyone,
    update: authenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc, req }) => {
        const merged = { ...originalDoc, ...data }
        const languages = validateLanguages(merged.languages)
        const regions = validateRegions(merged.regions, merged.languages)
        const errors = [
          ...(languages === true ? [] : [{ path: 'languages', message: languages }]),
          ...(regions === true ? [] : [{ path: 'regions', message: regions }]),
        ]
        // ValidationError is a public API error: Admin shows the message in a toast
        // and marks the field, instead of a generic "Something went wrong".
        if (errors.length) throw new ValidationError({ global: 'site-settings', errors, req })
        return data
      },
    ],
    beforeChange: [protectIntegrationSecrets],
    afterChange: [revalidateSiteSettings],
  },
  fields: [siteSettingsTabs],
  versions: false,
  endpoints: [createTestEmailEndpoint()],
}
