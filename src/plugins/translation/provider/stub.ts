import { GoogleTranslationProvider } from './google'
import type { TranslationProvider } from './types'
export const stubTranslationProvider: TranslationProvider = {
  translate: async ({ texts }) => [...texts],
}
export const createTranslationProvider = (apiKey?: string): TranslationProvider =>
  apiKey ? new GoogleTranslationProvider(apiKey) : stubTranslationProvider
