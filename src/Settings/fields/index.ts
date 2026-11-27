import type { TabsField } from 'payload'

import { blogTab } from './blog'
import { productTab } from './product'

export const settingsTabs: TabsField = {
  type: 'tabs',
  tabs: [blogTab, productTab],
}
