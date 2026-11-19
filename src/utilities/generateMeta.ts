import { localizeMetadata } from './i18n/seo'
import type { Metadata } from 'next'
import type { Blog, Page, Post } from '../payload-types'
import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'
import { formatTitle, getSiteIdentity } from './siteIdentity'

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | Partial<Blog> | null
  locale?: string
  path?: string
  sourceCollection?: string
  draft?: boolean
}): Promise<Metadata> => {
  const { doc } = args
  const identity = await getSiteIdentity({ locale: args.locale })
  const { siteName, siteDescription } = identity
  const image = doc?.meta?.image
  const ogImage = image && typeof image === 'object' && image.url
    ? new URL(image.url, getServerSideURL()).toString()
    : undefined

  const metaTitle = doc?.meta?.title?.trim()
  // Titles saved via the SEO generator can already include the current site name.
  const title = siteName && (metaTitle === siteName || metaTitle?.endsWith(` | ${siteName}`))
    ? metaTitle
    : formatTitle(metaTitle, siteName)
  const description = doc?.meta?.description?.trim() || siteDescription

  const metadata: Metadata = {
    ...(title && { title }),
    ...(description && { description }),
    openGraph: mergeOpenGraph(identity, {
      description,
      ...(ogImage && { images: [{ url: ogImage }] }),
      title,
      url: Array.isArray(doc?.slug) ? doc.slug.join('/') : '/',
    }),
  }
  return localizeMetadata(metadata, {
    path: args.path ?? (doc?.slug === 'home' ? '/' : `/${doc?.slug ?? ''}`),
    locale: args.locale,
    sourceCollection: args.sourceCollection ?? 'pages',
    sourceId: doc?.id ? String(doc.id) : undefined,
    draft: args.draft,
  })
}
