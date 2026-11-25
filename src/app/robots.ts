import type { MetadataRoute } from 'next'

import { getServerSideURL } from '@/utilities/getURL'

// Rendered per request so a prebuilt image advertises its runtime site URL, not the build URL.
export const dynamic = 'force-dynamic'

export const sitemapPaths = ['/pages-sitemap.xml', '/blogs-sitemap.xml', '/products-sitemap.xml']

export default function robots(): MetadataRoute.Robots {
  const siteURL = getServerSideURL()
  return {
    rules: { userAgent: '*', disallow: '/admin/' },
    sitemap: sitemapPaths.map((path) => `${siteURL}${path}`),
  }
}
