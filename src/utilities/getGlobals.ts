import type { Config } from '@/payload-types'

import configPromise from '@payload-config'
import { type DataFromGlobalSlug, getPayload } from 'payload'
import { unstable_cache } from 'next/cache'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0): Promise<DataFromGlobalSlug<T>> {
  const payload = await getPayload({ config: configPromise })

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) =>
  process.env.PLAYWRIGHT_TEST === 'true'
    ? () => getGlobal<T>(slug, depth)
    : unstable_cache(async () => getGlobal<T>(slug, depth), [slug, String(depth)], {
        tags: [`global_${slug}`],
      })

export const getCachedHeader = async () => getCachedGlobal('header', 1)()

export const getCachedFooter = async () => getCachedGlobal('footer', 1)()

export const getCachedSiteSettings = async () => getCachedGlobal('site-settings', 2)()
