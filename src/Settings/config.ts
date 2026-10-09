import type { GlobalConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

import { settingsTabs } from './fields'
import { revalidateSettings } from './hooks/revalidateSettings'
import { validateSettingsHeroImage } from './hooks/validateSettingsHeroImage'

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
    beforeChange: [validateSettingsHeroImage],
    afterChange: [revalidateSettings],
  },
}
