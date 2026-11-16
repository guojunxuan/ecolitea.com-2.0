import type { Field } from 'payload'
import { localeCatalog } from '@/i18n/catalog'
import { validateLanguages, validateRegions } from '@/i18n/settings'
export const languageFields: Field[] = [
  {
    name: 'languages',
    type: 'array',
    label: 'Manage languages',
    admin: {
      initCollapsed: true,
      description: "Add or remove languages here; set each language's status in the table above.",
    },
    validate: (value) => validateLanguages(value as Parameters<typeof validateLanguages>[0]),
    fields: [
      {
        name: 'code',
        type: 'select',
        required: true,
        options: localeCatalog
          .filter(({ code }) => code !== 'en')
          .map(({ code: value, label }) => ({ value, label })),
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        defaultValue: 'off',
        admin: { hidden: true },
        options: ['off', 'translating', 'live'],
      },
    ],
  },
]
export const regionFields: Field[] = [
  {
    name: 'regions',
    type: 'array',
    validate: (value, { data }) =>
      validateRegions(
        value as Parameters<typeof validateRegions>[0],
        (data as { languages?: { code: string; status: string }[] })?.languages,
      ),
    fields: [
      { name: 'label', type: 'text', required: true, label: 'Region Name' },
      { name: 'group', type: 'text', label: 'Group' },
      {
        name: 'locale',
        type: 'select',
        required: true,
        options: localeCatalog.map(({ code: value, label }) => ({ value, label })),
      },
    ],
  },
]
