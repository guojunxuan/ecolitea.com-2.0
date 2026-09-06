'use client'

import React from 'react'

import type { LogoImage } from '@/components/Logo/types'
import { DesktopNav } from './DesktopNav'
import { MobileNav } from './MobileNav'
import type { HeaderNavigationData } from './types'

type HeaderNavProps = HeaderNavigationData & {
  logo: LogoImage | null
  siteName: string
}

export const HeaderNav: React.FC<HeaderNavProps> = ({ logo, menuCta, navItems, siteName }) => {
  const navigation = { menuCta, navItems }

  return (
    <>
      <DesktopNav {...navigation} />
      <MobileNav {...navigation} logo={logo} siteName={siteName} />
    </>
  )
}
