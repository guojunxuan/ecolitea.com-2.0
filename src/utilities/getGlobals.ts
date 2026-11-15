import { getLocalizedDoc, translationTags } from './i18n/getLocalized'
import type { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { type DataFromGlobalSlug, getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0, locale = 'en'): Promise<DataFromGlobalSlug<T>> {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
    overrideAccess: false,
    draft: false,
  })

  return (await getLocalizedDoc(global, `global:${slug}`, locale, payload)) ?? global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0, locale = 'en') =>
  process.env.PLAYWRIGHT_TEST === 'true'
    ? () => getGlobal<T>(slug, depth, locale)
    : unstable_cache(async () => getGlobal<T>(slug, depth, locale), [slug, String(depth), locale], {
        tags: [`global_${slug}`, ...translationTags(`global:${slug}`, slug, locale)],
      })

export const getCachedHeader = async (locale = 'en') => getCachedGlobal('header', 1, locale)()

export const getCachedFooter = async (locale = 'en') => getCachedGlobal('footer', 1, locale)()

export const getCachedSiteSettings = async (locale = 'en') => getCachedGlobal('site-settings', 2, locale)()

export const getCachedSettings = async (locale = 'en') => getCachedGlobal('settings', 1, locale)()
