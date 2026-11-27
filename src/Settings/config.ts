import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

import { settingsTabs } from './fields'
import { revalidateSettings } from './hooks/revalidateSettings'
import { validateSettingsHeroImage } from './hooks/validateSettingsHeroImage'
import { validateSettingsSeoImage } from './hooks/validateSettingsSeoImage'
import { validateProductListingMedia } from './hooks/validateProductListingMedia'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Settings',
  typescript: {
    interface: 'Settings',
  },
  admin: { group: 'Site' },
  access: {
    read: anyone,
    update: authenticated,
    readVersions: authenticated,
  },
  fields: [settingsTabs],
  versions: { max: 20 },
  hooks: {
    beforeChange: [
      validateSettingsHeroImage,
      validateSettingsSeoImage,
      validateProductListingMedia,
    ],
    afterChange: [revalidateSettings],
  },
}
