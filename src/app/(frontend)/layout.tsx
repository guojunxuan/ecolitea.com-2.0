import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { resolveFavicon } from '@/components/Logo/resolveFavicon'
import { CookieBanner } from '@/consent/CookieBanner'
import { CookieSettingsDialog } from '@/consent/CookieSettingsDialog'
import { SkipLink } from '@/components/SkipLink'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { buildSiteMetadata } from '@/utilities/buildSiteMetadata'
import { getCachedSiteSettings } from '@/utilities/getGlobals'
import { resolveLinkHref } from '@/utilities/resolveLinkHref'

import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getCachedSiteSettings()

  return buildSiteMetadata(resolveFavicon(siteSettings.favicon))
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteSettings = await getCachedSiteSettings()

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en">
      <body>
        <Providers gtmDisabled={siteSettings.disableGtm === true}>
          <SkipLink href="#main-content">Skip to content</SkipLink>
          <Header />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
          <Footer />
          <CookieBanner
            cookiePolicyHref={
              siteSettings.cookiePolicyPage
                ? resolveLinkHref({
                    type: 'reference',
                    reference: { relationTo: 'pages', value: siteSettings.cookiePolicyPage },
                  })
                : null
            }
          />
          <CookieSettingsDialog />
        </Providers>
      </body>
    </html>
  )
}
