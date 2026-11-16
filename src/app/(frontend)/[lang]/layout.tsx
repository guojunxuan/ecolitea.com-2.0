import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getIntegrations } from '@/SiteSettings/integrations'
import { LanguageUnavailableNotice } from '@/i18n/LanguageUnavailableNotice'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { legalPagePaths } from '@/utilities/i18n/pageAccess'
import type { Metadata } from 'next'

import { getDictionary } from '@/i18n/getDictionary'
import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { resolveFavicon } from '@/components/Logo/resolveFavicon'
import { resolveConsentCopy } from '@/consent/copy'
import { CookieBanner } from '@/consent/CookieBanner'
import { CookieSettingsDialog } from '@/consent/CookieSettingsDialog'
import { SkipLink } from '@/components/SkipLink'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { Providers } from '@/providers'
import { buildSiteMetadata } from '@/utilities/buildSiteMetadata'
import { getCachedSiteSettings } from '@/utilities/getGlobals'
import { resolveLinkHref } from '@/utilities/resolveLinkHref'

import '../globals.css'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { notFound } from 'next/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getCachedSiteSettings()

  return buildSiteMetadata(resolveFavicon(siteSettings.favicon))
}

export const dynamicParams = true

export async function generateStaticParams() {
  const { publicLocales } = await getI18nSettings()
  return publicLocales.map(({ code: lang }) => ({ lang }))
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const i18n = await getI18nSettings()
  const { publicLocales } = i18n
  if (!publicLocales.some(({ code }) => code === lang)) notFound()
  const siteSettings = await getCachedSiteSettings(lang)
  const { gtm } = await getIntegrations(await getPayload({ config: configPromise }))
  const legalPaths = await legalPagePaths()
  const dictionary = await getDictionary(lang)

  return (
    <html className={cn(GeistSans.variable, GeistMono.variable)} lang={lang}>
      <body>
        <LocaleProvider
          i18n={i18n}
          locale={lang}
          legalPaths={legalPaths}
          englishLabel={dictionary.common.english}
        >
          <Providers
            dictionary={{
              ...dictionary,
              consent: resolveConsentCopy(siteSettings.cookieConsent, dictionary.consent),
            }}
            gtmContainerId={gtm.disabled ? null : gtm.containerId}
            gtmDisabled={gtm.disabled}
          >
            <SkipLink href="#main-content">{dictionary.common.skipToContent}</SkipLink>
            <Header locale={lang} />
            <main id="main-content" tabIndex={-1}>
              <LanguageUnavailableNotice />
              {children}
            </main>
            <Footer locale={lang} />
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
        </LocaleProvider>
      </body>
    </html>
  )
}
