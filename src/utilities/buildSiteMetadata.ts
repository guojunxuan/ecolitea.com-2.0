import type { FaviconPresentation } from '@/components/Logo/resolveFavicon'
import type { Metadata } from 'next'

import { getServerSideURL } from './getURL'
import { mergeOpenGraph } from './mergeOpenGraph'

export const buildSiteMetadata = (favicon: FaviconPresentation | null): Metadata => ({
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
  icons: favicon
    ? {
        icon: [
          {
            url: favicon.url,
            ...(favicon.type && { type: favicon.type }),
          },
        ],
      }
    : {
        icon: [
          { url: '/favicon.ico', sizes: '32x32' },
          { url: '/favicon.svg', type: 'image/svg+xml' },
        ],
      },
})
