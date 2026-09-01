import type { GlobalConfig } from 'payload'

import { navigationColumns } from '@/fields/navigationColumns'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
  },
  fields: [
    navigationColumns({
      name: 'columns',
      label: 'Navigation columns',
      description:
        'Manage footer navigation here. Branding, contact details, social links, company details, and copyright are managed in Site Settings.',
      minRows: 1,
      maxRows: 4,
      navItems: {
        minRows: 1,
        maxRows: 8,
      },
      rowLabels: {
        column: '@/Footer/RowLabel#ColumnRowLabel',
        navItem: '@/Footer/RowLabel#NavItemRowLabel',
      },
    }),
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
  versions: false,
}
