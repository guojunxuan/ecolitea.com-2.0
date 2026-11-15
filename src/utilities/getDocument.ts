import { getLocalizedDoc, translationTags } from './i18n/getLocalized'
import type { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Collection = keyof Config['collections']

async function getDocument(collection: Collection, slug: string, depth = 0, locale = 'en') {
  const payload = await getPayload({ config: configPromise })

  const page = await payload.find({
    collection,
    depth,
    draft: false,
    overrideAccess: false,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return getLocalizedDoc(page.docs[0], collection, locale, payload)
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedDocument = (collection: Collection, slug: string, locale = 'en') =>
  unstable_cache(async () => getDocument(collection, slug, 0, locale), [collection, slug, locale], {
    tags: [`${collection}_${slug}`, ...translationTags(collection, slug, locale)],
  })
