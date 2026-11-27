import { HeaderClient } from './Component.client'
import { resolveSiteAsset } from '@/components/Logo/resolveSiteAsset'
import { getCachedHeader, getCachedSiteSettings } from '@/utilities/getGlobals'
import React from 'react'
import { adaptHeaderNavigation } from './Nav/adaptNavigation'

export async function Header({ locale = 'en' }: { locale?: string } = {}) {
  const [headerData, siteSettings] = await Promise.all([
    getCachedHeader(locale),
    getCachedSiteSettings(locale),
  ])
  const navigation = adaptHeaderNavigation(headerData)

  return (
    <HeaderClient
      logo={resolveSiteAsset(siteSettings.logo)}
      menuCta={navigation.menuCta}
      navItems={navigation.navItems}
      siteName={siteSettings.siteName}
    />
  )
}
