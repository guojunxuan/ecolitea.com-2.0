import type { Field, Payload, Where } from 'payload'
import { mergeTranslation } from '@/plugins/translation/read'
import { getTranslationRule } from '@/plugins/translation/rules'

export const localizedCacheKey = (collection: string, id: string, locale: string) =>
  ['localized-v1', collection, id, locale]
export const translationTags = (collection: string, id: string, locale: string) =>
  [`translation:${collection}:${id}:${locale}`, `translations:${locale}`]

/** Public readers supply their existing access/visibility-filtered source snapshot.
 * Draft readers deliberately bypass this boundary and every shared locale cache. */
export async function getLocalizedDoc<T>(
  doc: T | null | undefined, collection: string, locale = 'en', suppliedPayload?: Payload,
): Promise<T | null> {
  if (!doc) return null
  if (locale === 'en') return doc
  const source = doc as Record<string, unknown>
  if (source._status && source._status !== 'published') return null
  if (['blogs', 'products', 'posts', 'case-studies'].includes(collection) &&
    typeof source.publishedAt === 'string' && new Date(source.publishedAt) > new Date()) return null
  const id = collection.startsWith('global:') ? collection.slice(7) : String(source.id)
  const merged = await mergeTranslation(doc, { sourceCollection: collection, sourceId: id, locale, payload: suppliedPayload })
  if (!merged) return null
  const payload = suppliedPayload ?? await (async () => {
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
    return getPayload({ config })
  })()
  return localizePopulated(merged, collection, locale, payload)
}

/** Follow public field configuration, never infer a related collection from an ID
 * or property name. Batch all populated relationships in one translation query. */
export async function localizePopulated<T>(doc: T, collection: string, locale: string, payload: Payload): Promise<T> {
  if (locale === 'en') return doc
  const copy = structuredClone(doc)
  const relationships: { parent: Record<string, unknown> | unknown[]; key: string | number; collection: string; doc: Record<string, unknown> }[] = []
  const fieldsFor = (slug: string): Field[] => slug.startsWith('global:')
    ? payload.config.globals?.find((item) => item.slug === slug.slice(7))?.fields ?? []
    : payload.config.collections.find((item) => item.slug === slug)?.fields ?? []
  function walk(value: unknown, fields: Field[], depth: number) {
    if (!value || typeof value !== 'object' || depth > 8) return
    const record = value as Record<string, unknown>
    for (const field of fields) {
      if ('tabs' in field) for (const tab of field.tabs) walk('name' in tab && tab.name ? record[tab.name] : record, tab.fields, depth)
      if (!('name' in field) || !field.name) {
        if ('fields' in field) walk(record, field.fields, depth)
        continue
      }
      const name = field.name
      const current = record[name]
      if ((field.type === 'relationship' || field.type === 'upload') && current) {
        const visit = (parent: Record<string, unknown> | unknown[], key: string | number, item: unknown) => {
          if (!item || typeof item !== 'object') return
          const row = item as Record<string, unknown>
          const slug = typeof field.relationTo === 'string' ? field.relationTo : String(row.relationTo)
          const related = typeof field.relationTo === 'string' ? row : row.value as Record<string, unknown>
          if (!related || typeof related !== 'object' || !related.id) return
          if (getTranslationRule(slug)) relationships.push({ parent: typeof field.relationTo === 'string' ? parent : row, key: typeof field.relationTo === 'string' ? key : 'value', collection: slug, doc: related })
          walk(related, fieldsFor(slug), depth + 1)
        }
        if (Array.isArray(current)) current.forEach((item, index) => visit(current, index, item))
        else visit(record, name, current)
      } else if (field.type === 'blocks' && Array.isArray(current)) {
        for (const row of current) walk(row, field.blocks.find((block) => block.slug === row.blockType)?.fields ?? [], depth + 1)
      } else if ('fields' in field) {
        if (Array.isArray(current)) current.forEach((row) => walk(row, field.fields, depth + 1))
        else walk(current, field.fields, depth + 1)
      }
    }
  }
  walk(copy, fieldsFor(collection), 0)
  if (!relationships.length) return copy
  const result = await payload.find({
    collection: 'translations', depth: 0, overrideAccess: true, pagination: false,
    where: { and: [{ locale: { equals: locale } }, { or: relationships.map((item): Where => ({ and: [
      { sourceCollection: { equals: item.collection } }, { sourceId: { equals: String(item.doc.id) } },
    ] })) }] },
  })
  const { merge } = await import('@/plugins/translation/merge')
  // Deep children first; missing related translations retain the English object.
  for (const item of relationships.reverse()) {
    const row = result.docs.find((row) => row.sourceCollection === item.collection && row.sourceId === String(item.doc.id))
    if (!row?.lastReadySourceVersion || !row.fields || typeof row.fields !== 'object') continue
    const fields = Object.fromEntries(Object.entries(row.fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    const translated = merge(item.doc, fields, getTranslationRule(item.collection)!)
    if (Array.isArray(item.parent)) item.parent[Number(item.key)] = translated
    else item.parent[String(item.key)] = translated
  }
  return copy
}

export async function getLocalizedList<T>(docs: T[], collection: string, locale = 'en', payload?: Payload): Promise<T[]> {
  if (locale === 'en') return docs
  const result = await Promise.all(docs.map((doc) => getLocalizedDoc(doc, collection, locale, payload)))
  return result.filter((doc) => doc !== null) as T[]
}
