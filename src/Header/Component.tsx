import { HeaderClient } from './Component.client'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { getCachedGlobal } from '@/utilities/getGlobals'
import React from 'react'

export async function Header() {
  const [headerData, siteSettings] = await Promise.all([
    getCachedGlobal('header', 1)(),
    getCachedGlobal('site-settings', 1)(),
  ])

  return (
    <HeaderClient
      data={headerData}
      logo={resolveBrandAsset(siteSettings.logo)}
      logoDark={resolveBrandAsset(siteSettings.logoDark)}
    />
  )
}
