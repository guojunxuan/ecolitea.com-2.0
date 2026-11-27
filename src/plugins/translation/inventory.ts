import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, Where } from 'payload'
import { extract } from './extract'
import { getTranslationRule } from './rules'
import { getFrontendDictionarySource } from './dictionary'
import type { SourceDocument, TranslationInput } from './task'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import { publicProductVisibility } from '@/utilities/products/publicVisibility'
const estimateCharacters = (doc: SourceDocument, source: string) => {
  const rule = getTranslationRule(source)
  const texts = new Map<string, string>()
  for (const entry of rule ? extract(doc, rule) : [])
    texts.set(`${entry.kind}:${entry.source}`, entry.source)
  return [...texts.values()].reduce((total, text) => total + Array.from(text).length, 0)
}

export async function getTranslationInventory(
  payload: Payload,
  req?: PayloadRequest,
  now = new Date(),
  locale = 'en',
) {
  const sources: { input: TranslationInput; characters: number }[] = []
  const add = async (input: TranslationInput, characters: number) => {
    sources.push({ input, characters })
  }
  const legalIDs = await getLegalIDs(payload, req)
  for (const collection of payload.config.collections) {
    if (!getTranslationRule(collection.slug)) continue
    const where: Where =
      collection.slug === 'blogs'
        ? publicBlogVisibility(now)
        : collection.slug === 'products'
          ? publicProductVisibility(now)
          : collection.versions?.drafts
            ? { _status: { equals: 'published' } }
            : {}
    let page = 1
    let hasNextPage: boolean
    do {
      const result = await payload.find({
        collection: collection.slug as CollectionSlug,
        depth: 0,
        draft: false,
        overrideAccess: true,
        where,
        sort: 'id',
        limit: 100,
        page,
        req,
      })
      for (const doc of result.docs as unknown as SourceDocument[]) {
        if (collection.slug === 'pages' && legalIDs.has(String(doc.id))) continue
        if (!doc.updatedAt) throw new Error(`Source has no version: ${collection.slug}:${doc.id}`)
        await add(
          {
            sourceCollection: collection.slug,
            sourceId: String(doc.id),
            locale,
            sourceVersion: doc.updatedAt,
          },
          estimateCharacters(doc, collection.slug),
        )
      }
      hasNextPage = result.hasNextPage
      page++
    } while (hasNextPage)
  }
  for (const global of payload.config.globals) {
    const sourceCollection = `global:${global.slug}`
    if (!getTranslationRule(sourceCollection)) continue
    const doc = (await payload.findGlobal({
      slug: global.slug as GlobalSlug,
      depth: 0,
      draft: false,
      overrideAccess: true,
      req,
    })) as SourceDocument
    // An unsaved Global has no persisted source version to translate.
    if (!doc.updatedAt) continue
    await add(
      { sourceCollection, sourceId: global.slug, locale, sourceVersion: doc.updatedAt },
      estimateCharacters(doc, sourceCollection),
    )
  }
  const dictionary = getFrontendDictionarySource()
  const characters = [
    ...new Set(extract(dictionary.doc, dictionary.rule).map(({ source }) => source)),
  ].reduce((total, text) => total + Array.from(text).length, 0)
  await add(
    {
      sourceCollection: 'dictionary',
      sourceId: 'frontend',
      locale,
      sourceVersion: dictionary.sourceVersion,
    },
    characters,
  )
  return sources
}

async function getLegalIDs(payload: Payload, req?: PayloadRequest): Promise<Set<string>> {
  if (!payload.config.globals.some(({ slug }) => slug === 'site-settings')) return new Set()
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    overrideAccess: true,
    req,
  })
  return new Set(
    [settings.privacyPolicyPage, settings.cookiePolicyPage, settings.termsPage]
      .filter(Boolean)
      .map((value) => String(typeof value === 'object' ? value!.id : value)),
  )
}
