import { HeaderClient } from './Component.client'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
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
      logo={resolveBrandAsset(siteSettings.logo)}
      menuCta={navigation.menuCta}
      navItems={navigation.navItems}
      siteName={siteSettings.siteName}
    />
  )
}
