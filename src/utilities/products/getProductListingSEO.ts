import { unstable_cache } from 'next/cache'

import { getCachedSettings } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'

export type ProductListingSEOModel = {
  title?: string
  description?: string
  imageURL?: string
}

function resolveImageURL(url: string): string | undefined {
  try {
    const resolved = new URL(url, getServerSideURL())
    return resolved.protocol === 'http:' || resolved.protocol === 'https:'
      ? resolved.toString()
      : undefined
  } catch {
    return undefined
  }
}

async function readProductListingSEO(locale = 'en'): Promise<ProductListingSEOModel> {
  const settings = await getCachedSettings(locale)
  const seo = settings?.product?.seo
  const title = seo?.title?.trim()
  const description = seo?.description?.trim()
  const image = seo?.image
  const imageURL =
    image && typeof image === 'object' && image.url ? resolveImageURL(image.url) : undefined

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageURL ? { imageURL } : {}),
  }
}

export const getProductListingSEO = (locale = 'en'): Promise<ProductListingSEOModel> =>
  unstable_cache(() => readProductListingSEO(locale), ['products-listing-seo', locale], {
    tags: ['global_settings', `translations:${locale}`],
    revalidate: 600,
  })()
