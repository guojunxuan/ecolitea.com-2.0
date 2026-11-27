import type { Metadata } from 'next'
import type { SiteIdentity } from './siteIdentity'

export const mergeOpenGraph = (
  { siteName, siteDescription }: SiteIdentity,
  { title = siteName, description = siteDescription, images, ...og }: NonNullable<Metadata['openGraph']> = {},
): Metadata['openGraph'] => ({
  type: 'website',
  ...(siteName && { siteName }),
  ...og,
  ...(title && { title }),
  ...(description && { description }),
  ...(images && { images }),
})
