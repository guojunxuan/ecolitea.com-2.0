import type { Plugin } from 'payload'
import { translations } from './collections/translations'
import { translationSearch } from './collections/translationSearch'

export const translationPlugin = (): Plugin => (config) => ({
  ...config,
  collections: [...(config.collections ?? []), translations, translationSearch],
})
