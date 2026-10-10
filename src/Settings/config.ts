import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

import { settingsTabs } from './fields'
import { revalidateSettings } from './hooks/revalidateSettings'
import { validateSettingsHeroImage } from './hooks/validateSettingsHeroImage'
import { validateSettingsSeoImage } from './hooks/validateSettingsSeoImage'

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Settings',
  typescript: {
    interface: 'Settings',
  },
  access: {
    read: anyone,
    update: authenticated,
  },
  fields: [settingsTabs],
  versions: false,
  hooks: {
    beforeChange: [validateSettingsHeroImage, validateSettingsSeoImage],
    afterChange: [revalidateSettings],
  },
}
