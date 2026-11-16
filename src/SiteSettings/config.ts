import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

import { validateLanguages, validateRegions } from '@/i18n/settings'
import { siteSettingsTabs } from './fields'
import { revalidateSiteSettings } from './hooks/revalidateSiteSettings'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  typescript: {
    interface: 'SiteSettings',
  },
  access: {
    read: anyone,
    update: authenticated,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        const merged = { ...originalDoc, ...data }
        const result = validateLanguages(merged.languages)
        const regions = validateRegions(merged.regions, merged.languages)
        if (result !== true || regions !== true)
          throw new Error(String(result !== true ? result : regions))
        return data
      },
    ],
    afterChange: [revalidateSiteSettings],
  },
  fields: [siteSettingsTabs],
  versions: false,
}
