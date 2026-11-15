import type { CollectionConfig, Field } from 'payload'
import { authenticated } from '@/access/authenticated'

const fields: Field[] = [
  { name: 'sourceCollection', type: 'text', required: true, admin: { readOnly: true } },
  { name: 'sourceId', type: 'text', required: true, admin: { readOnly: true } },
  { name: 'locale', type: 'text', required: true, admin: { readOnly: true } },
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'pending',
    options: ['pending', 'waiting_quota', 'ready', 'failed'],
    admin: { readOnly: true },
  },
  { name: 'requestedSourceVersion', type: 'text', admin: { readOnly: true } },
  { name: 'lastReadySourceVersion', type: 'text', admin: { readOnly: true } },
  { name: 'ruleVersion', type: 'number', admin: { readOnly: true } },
  { name: 'fields', type: 'json', admin: { readOnly: true } },
  { name: 'error', type: 'text', admin: { readOnly: true } },
  { name: 'characters', type: 'number', min: 0, admin: { readOnly: true } },
  { name: 'translatedAt', type: 'date', admin: { readOnly: true } },
]

export const translations: CollectionConfig = {
  slug: 'translations',
  disableDuplicate: true,
  admin: {
    group: 'System',
    defaultColumns: ['sourceCollection', 'sourceId', 'locale', 'status', 'translatedAt'],
  },
  // Users has no role field: existing authenticated staff access is the admin boundary.
  access: { read: authenticated, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['sourceCollection', 'sourceId', 'locale'], unique: true }],
  fields,
}
