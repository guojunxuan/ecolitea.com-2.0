import type { GlobalConfig } from 'payload'

import { authenticated } from '@/access/authenticated'
import { labeledNavigationLink } from './fields/links'
import { navigationItems } from './fields/navigationItems'
import { normalizeHeader } from './hooks/normalizeHeader'
import { revalidateHeader } from './hooks/revalidateHeader'

export const Header: GlobalConfig = {
  slug: 'header',
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    navigationItems(),
    {
      name: 'enableMenuCta',
      type: 'checkbox',
      label: 'Enable Menu CTA Button',
      defaultValue: false,
    },
    labeledNavigationLink({
      name: 'menuCta',
      label: 'Menu CTA Button',
      admin: {
        condition: (_, siblingData) => siblingData?.enableMenuCta === true,
      },
    }),
  ],
  hooks: {
    beforeValidate: [normalizeHeader],
    afterChange: [revalidateHeader],
  },
  versions: false,
}
