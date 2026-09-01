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
      overrides: {
        minRows: 1,
        maxRows: 4,
        admin: {
          description:
            'Manage footer navigation here. Branding, contact details, social links, company details, and copyright are managed in Site Settings.',
          components: {
            RowLabel: '@/Footer/RowLabel#ColumnRowLabel',
          },
        },
      },
      navItemsOverrides: {
        minRows: 1,
        maxRows: 8,
        admin: {
          components: {
            RowLabel: '@/Footer/RowLabel#NavItemRowLabel',
          },
        },
      },
    }),
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
  versions: false,
}
