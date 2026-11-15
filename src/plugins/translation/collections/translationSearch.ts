import type { CollectionConfig } from 'payload'

export const translationSearch: CollectionConfig = {
  slug: 'translation-search',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['sourceCollection', 'sourceId', 'locale'], unique: true }],
  fields: [
    { name: 'sourceCollection', type: 'text', required: true },
    { name: 'sourceId', type: 'text', required: true },
    { name: 'locale', type: 'text', required: true },
    { name: 'sourceVersion', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'path', type: 'text', required: true },
    { name: 'ready', type: 'checkbox', defaultValue: false },
  ],
}
