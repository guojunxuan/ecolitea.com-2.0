import type { GlobalConfig } from 'payload'

import { link } from '@/fields/link'
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
      relationTo: ['pages', 'posts', 'case-studies', 'categories'],
      overrides: { name: 'menuCta', label: 'Menu CTA Button' },
    }),
  ],
  hooks: {
    afterChange: [revalidateHeader],
  },
  versions: false,
}
