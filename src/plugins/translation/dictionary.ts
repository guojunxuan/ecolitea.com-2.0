import { createHash } from 'node:crypto'
import { createPayloadRequest, type Payload } from 'payload'
import en from '@/i18n/dictionaries/en.json'
import { serverEnv } from '@/utilities/env'
import { extract } from './extract'
import type { TranslationRule } from './rules'
import type { TranslationRuntime } from './task'

export const frontendDictionary = en

export function dictionaryVersion(dictionary: unknown = en): string {
  return createHash('sha256').update(JSON.stringify(dictionary)).digest('hex')
}

function dictionaryRule(value: unknown, prefix = ''): TranslationRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      // The example address is a shared input hint, not prose to translate.
      if (path === 'quote.emailPlaceholder') return [[path, 'exclude']]
      return typeof child === 'string'
        ? [[path, 'translate']]
        : Object.entries(dictionaryRule(child, path))
    }),
  )
}

/** Dictionary content is its own source model; its SHA-256 is not an ordered timestamp. */
export function getFrontendDictionarySource() {
  const sourceVersion = dictionaryVersion()
  return { doc: { ...en, updatedAt: sourceVersion }, rule: dictionaryRule(en), sourceVersion }
}

/** Keep named interpolation variables intact before a dictionary result can become ready. */
export function validateDictionaryFields(fields: Readonly<Record<string, string>>): void {
  const source = getFrontendDictionarySource()
  const templates = new Map(
    extract(source.doc, source.rule).map(({ path, source }) => [path, source]),
  )
  const placeholders = (value: string) => (value.match(/\{[a-zA-Z][\w]*\}/g) ?? []).sort().join('|')
  for (const [path, value] of Object.entries(fields)) {
    const original = templates.get(path)
    if (original !== undefined && placeholders(original) !== placeholders(value)) {
      throw new Error(`Dictionary placeholder mismatch: ${path}`)
    }
  }
}

export async function enqueueFrontendDictionary(
  payload: Payload,
  runtime: TranslationRuntime,
): Promise<void> {
  if (!serverEnv.JOBS_AUTORUN) return
  const { sourceVersion } = getFrontendDictionarySource()
  const req = await createPayloadRequest({ payload })
  if (!(await runtime.canQueue(req))) return
  for (const locale of await runtime.getTargets(req)) {
    const existing = (
      await payload.find({
        collection: 'translations',
        where: {
          and: [
            { sourceCollection: { equals: 'dictionary' } },
            { sourceId: { equals: 'frontend' } },
            { locale: { equals: locale } },
          ],
        },
        limit: 1,
        depth: 0,
        req,
      })
    ).docs[0]
    // Retry and quota recovery own unchanged failures; startup only produces new content hashes.
    if (existing?.requestedSourceVersion === sourceVersion) continue
    await runtime.queue(req, {
      sourceCollection: 'dictionary',
      sourceId: 'frontend',
      locale,
      sourceVersion,
    })
  }
}
