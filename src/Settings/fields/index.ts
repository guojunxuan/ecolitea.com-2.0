import type { TabsField } from 'payload'

import { blogTab } from './blog'

export const settingsTabs: TabsField = {
  type: 'tabs',
  tabs: [blogTab],
}
