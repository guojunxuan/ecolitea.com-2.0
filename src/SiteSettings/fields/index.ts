import type { TabsField } from 'payload'

import { brandingTab } from './branding'
import { contactTab } from './contact'
import { generalTab } from './general'
import { legalTab } from './legal'
import { socialTab } from './social'

export { socialPlatformOptions, validateAbsoluteHttpURL } from './social'

export const siteSettingsTabs: TabsField = {
  type: 'tabs',
  tabs: [generalTab, brandingTab, contactTab, socialTab, legalTab],
}
