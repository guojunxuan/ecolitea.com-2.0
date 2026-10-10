import { getCachedSettings } from '@/utilities/getGlobals'
import { getServerSideURL } from '@/utilities/getURL'

export type BlogListingSEOModel = {
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

export async function getBlogListingSEO(): Promise<BlogListingSEOModel> {
  const settings = await getCachedSettings()
  const seo = settings?.blog?.listing?.seo
  const title = seo?.title?.trim()
  const description = seo?.description?.trim()
  const image = seo?.image
  const imageURL =
    image && typeof image === 'object' && image.url
      ? resolveImageURL(image.url)
      : undefined

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageURL ? { imageURL } : {}),
  }
}
