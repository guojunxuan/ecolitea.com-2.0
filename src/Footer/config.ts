import type { GlobalConfig } from 'payload'

import { authenticated } from '@/access/authenticated'
import { navigationColumns } from '@/fields/navigationColumns'
import {
  trimText,
  validateFooterColumnLabels,
  validateFooterNavigationLinks,
  validateFooterURL,
  validateNonBlankText,
} from './validation'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    navigationColumns({
      columnLabelOverrides: {
        hooks: { beforeChange: [trimText] },
        validate: validateNonBlankText,
      },
      linkLabelOverrides: {
        hooks: { beforeChange: [trimText] },
        validate: validateNonBlankText,
      },
      relationTo: ['pages', 'posts', 'case-studies', 'categories'],
      overrides: {
        maxRows: 4,
        validate: validateFooterColumnLabels,
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
        validate: validateFooterNavigationLinks,
        admin: {
          components: {
            RowLabel: '@/Footer/RowLabel#NavItemRowLabel',
          },
        },
      },
      urlOverrides: {
        hooks: { beforeChange: [trimText] },
        validate: validateFooterURL,
      },
    }),
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
  versions: false,
}
