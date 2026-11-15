import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { headers } from 'next/headers'
import { getPayload, type DataFromCollectionSlug } from 'payload'
import config from '@payload-config'
import { getLocalizedDoc, translationTags } from './getLocalized'

type SourceCollection = 'pages' | 'posts' | 'case-studies'
export const getDocumentBySlug = cache(async <T extends SourceCollection>(collection: T, slug: string, locale = 'en', draft = false): Promise<DataFromCollectionSlug<T> | null> => {
  const payload = await getPayload({ config })
  if (draft) {
    const { user } = await payload.auth({ headers: await headers() })
    if (!user) return null
    const result = await payload.find({ collection, depth: 2, draft: true, overrideAccess: false, user, limit: 1, pagination: false, where: { slug: { equals: slug } } })
    return result.docs[0] ?? null
  }
  const lookup = await payload.find({ collection, depth: 0, draft: false, overrideAccess: false, limit: 1, pagination: false, where: { slug: { equals: slug } } })
  const id = lookup.docs[0]?.id
  if (!id) return null
  return unstable_cache(async () => {
    const result = await payload.find({ collection, depth: 2, draft: false, overrideAccess: false, limit: 1, pagination: false, where: { id: { equals: id } } })
    return getLocalizedDoc(result.docs[0], collection, locale, payload)
  }, ['content-detail', collection, id, locale], { tags: [`${collection}_${slug}`, ...translationTags(collection, id, locale)], revalidate: 600 })()
})
