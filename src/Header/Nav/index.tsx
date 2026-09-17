'use client'

import React from 'react'

import type { LogoImage } from '@/components/Logo/types'
import { DesktopNav } from './DesktopNav'
import { MobileNav } from './MobileNav'
import type { HeaderNavigationData } from './types'

type HeaderNavProps = HeaderNavigationData & {
  logo: LogoImage | null
  onDesktopOpenChange?: (open: boolean) => void
  onMobileOpenChange?: (open: boolean) => void
  siteName: string
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  logo,
  menuCta,
  navItems,
  onDesktopOpenChange,
  onMobileOpenChange,
  siteName,
}) => {
  const navigation = { menuCta, navItems }

  return (
    <>
      <DesktopNav {...navigation} onOpenChange={onDesktopOpenChange} />
      <MobileNav {...navigation} logo={logo} onOpenChange={onMobileOpenChange} siteName={siteName} />
    </>
  )
}
