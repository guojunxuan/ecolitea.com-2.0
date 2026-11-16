import type { Payload } from 'payload'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { sourceLocale } from '@/i18n/config'
import { getFrontendDictionarySource, validateDictionaryFields } from './dictionary'
import { asRecord } from './lexical'
import { merge } from './merge'
import { getTranslationRule } from './rules'

type ReadOptions = { sourceCollection: string; sourceId: string; locale: string; payload?: Payload }

/** Backend-only read boundary. Phase 3 routes separately enforce publicLocales. */
export async function mergeTranslation<T>(doc: T, options: ReadOptions): Promise<T | null> {
  const { sourceCollection, sourceId, locale } = options
  if (locale === sourceLocale) return doc
  const { targetLocales } = await getI18nSettings(options.payload)
  if (!targetLocales.some(({ code }) => code === locale)) return null
  const rule =
    sourceCollection === 'dictionary' && sourceId === 'frontend'
      ? getFrontendDictionarySource().rule
      : getTranslationRule(sourceCollection)
  if (!rule) return null
  let payload = options.payload
  if (!payload) {
    const [{ getPayload }, { default: config }] = await Promise.all([
      import('payload'),
      import('@payload-config'),
    ])
    payload = await getPayload({ config })
  }
  const row = (
    await payload.find({
      collection: 'translations',
      where: {
        and: [
          { sourceCollection: { equals: sourceCollection } },
          { sourceId: { equals: sourceId } },
          { locale: { equals: locale } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0]
  // Spec §4.4 retains the last-ready result when a newer request is pending or failed.
  // Filtering by status=ready would hide that valid checkpoint (the plan's ready-only line).
  const fields = asRecord(row?.fields)
  if (!row?.lastReadySourceVersion || !fields) return null
  const textFields = Object.fromEntries(
    Object.entries(fields).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
  if (sourceCollection === 'dictionary') {
    try {
      // A retained dictionary may predate an interpolation variable rename.
      validateDictionaryFields(textFields)
    } catch {
      return null
    }
  }
  return merge(doc, textFields, rule)
}
