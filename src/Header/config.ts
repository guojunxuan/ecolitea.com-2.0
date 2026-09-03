import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
import { headerLinkTargets } from './fields/dropdownItems'
import { navigationItems } from './fields/navigationItems'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
  },
  fields: [
    navigationItems(),
    link({
      appearances: false,
      relationTo: headerLinkTargets,
      overrides: { name: 'menuCta', label: 'Menu CTA Button' },
    }),
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
  versions: false,
}
