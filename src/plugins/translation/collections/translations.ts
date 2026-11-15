import type { CollectionConfig, Field } from 'payload'
import { authenticated } from '@/access/authenticated'

const fields: Field[] = [
  { name: 'sourceCollection', type: 'text', required: true },
  { name: 'sourceId', type: 'text', required: true },
  { name: 'locale', type: 'text', required: true },
  {
    name: 'status',
    type: 'select',
    required: true,
    defaultValue: 'pending',
    options: ['pending', 'waiting_quota', 'ready', 'failed'],
  },
  { name: 'requestedSourceVersion', type: 'text' },
  { name: 'lastReadySourceVersion', type: 'text' },
  { name: 'ruleVersion', type: 'number' },
  { name: 'fields', type: 'json' },
  { name: 'error', type: 'text' },
  { name: 'characters', type: 'number', min: 0 },
  { name: 'translatedAt', type: 'date' },
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
  fields: fields.map((field) => ({ ...field, admin: { ...field.admin, readOnly: true } })),
}
