'use client'

import React, { useRef } from 'react'

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
  const desktopRootRef = useRef<HTMLDivElement>(null)
  const mobileTriggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <DesktopNav
        {...navigation}
        compactFocusTargetRef={mobileTriggerRef}
        onOpenChange={onDesktopOpenChange}
        rootElementRef={desktopRootRef}
      />
      <MobileNav
        {...navigation}
        desktopNavigationRef={desktopRootRef}
        logo={logo}
        onOpenChange={onMobileOpenChange}
        siteName={siteName}
        triggerRef={mobileTriggerRef}
      />
    </>
  )
}
