import { HeaderClient } from './Component.client'
import { resolveSiteAsset } from '@/components/Logo/resolveSiteAsset'
import { getCachedHeader, getCachedSiteSettings } from '@/utilities/getGlobals'
import React from 'react'
import { adaptHeaderNavigation } from './Nav/adaptNavigation'

export async function Header() {
  const [headerData, siteSettings] = await Promise.all([
    getCachedHeader(),
    getCachedSiteSettings(),
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
