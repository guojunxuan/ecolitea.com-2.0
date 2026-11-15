import type { Plugin } from 'payload'
import { translations } from './collections/translations'
import { translationSearch } from './collections/translationSearch'
import { translationUsage } from './collections/translationUsage'

export const translationPlugin = (): Plugin => (config) => ({
  ...config,
  collections: [...(config.collections ?? []), translations, translationSearch],
  globals: [...(config.globals ?? []), translationUsage],
})
