import { localizeMetadata } from './i18n/seo'
import type { Metadata } from 'next'

import type { Blog, Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/website-template-OG.webp'

  if (image && typeof image === 'object' && 'url' in image && image.url) {
    url = new URL(image.url, serverUrl).toString()
  }

  return url
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | Partial<Blog> | null
  locale?: string
  path?: string
  sourceCollection?: string
  draft?: boolean
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  const title = doc?.meta?.title
    ? doc?.meta?.title + ' | Payload Website Template'
    : 'Payload Website Template'

  const metadata: Metadata = {
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
  return localizeMetadata(metadata, {
    path: args.path ?? (doc?.slug === 'home' ? '/' : `/${doc?.slug ?? ''}`),
    locale: args.locale,
    sourceCollection: args.sourceCollection ?? 'pages',
    sourceId: doc?.id ? String(doc.id) : undefined,
    draft: args.draft,
  })
}
