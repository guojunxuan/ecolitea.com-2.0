import type { Payload } from 'payload'
import en from './dictionaries/en.json'
import type { FrontendDictionary } from './types'
import { sourceLocale } from './config'
import { mergeTranslation } from '@/plugins/translation/read'

/** Server read boundary. Only the resolved language is passed into client components. */
export async function getDictionary(
  lang: string,
  { payload }: { payload?: Payload } = {},
): Promise<FrontendDictionary> {
  if (lang === sourceLocale) return en
  // mergeTranslation overlays allowlisted translated fields onto the current English
  // source, so every absent key (including newly introduced copy) stays English.
  return (
    (await mergeTranslation(en, {
      sourceCollection: 'dictionary',
      sourceId: 'frontend',
      locale: lang,
      payload,
    })) ?? en
  )
}
