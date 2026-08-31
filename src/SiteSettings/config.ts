import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

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
    afterChange: [revalidateSiteSettings],
  },
  fields: [siteSettingsTabs],
  versions: false,
}
