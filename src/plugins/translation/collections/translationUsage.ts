import type { GlobalConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

// Separate from translation documents so publication/deletion never resets usage.
export const translationUsage: GlobalConfig = {
  slug: 'translation-usage',
  label: 'Translation Usage',
  admin: {
    hidden: true,
    group: 'System',
    description:
      'Conservative reserved characters for the UTC calendar month. Resets on the first reservation in a new month.',
  },
  access: { read: authenticated, update: () => false },
  fields: [
    { name: 'month', type: 'text', admin: { readOnly: true } },
    { name: 'characters', type: 'number', min: 0, defaultValue: 0, admin: { readOnly: true } },
  ],
}
