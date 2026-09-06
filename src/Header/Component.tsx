import { HeaderClient } from './Component.client'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'
import { adaptHeaderNavigation } from './Nav/adaptNavigation'

export async function Header() {
  const [headerData, siteSettings] = await Promise.all([
    getCachedGlobal('header', 1)(),
    getCachedGlobal('site-settings', 1)(),
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
