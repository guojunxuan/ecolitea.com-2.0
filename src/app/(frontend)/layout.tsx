import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { resolveFavicon } from '@/components/Logo/resolveFavicon'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { buildSiteMetadata } from '@/utilities/buildSiteMetadata'
import { getCachedSiteSettings } from '@/utilities/getGlobals'

import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getCachedSiteSettings()

  return buildSiteMetadata(resolveFavicon(siteSettings.favicon))
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang="en">
      <body>
        <Providers>
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
