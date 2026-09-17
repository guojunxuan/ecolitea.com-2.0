'use client'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { Logo } from '@/components/Logo/Logo'
import type { LogoImage } from '@/components/Logo/types'
import { HeaderNav } from './Nav'
import type { HeaderNavigationData } from './Nav/types'
import styles from './Component.module.css'

interface HeaderClientProps extends HeaderNavigationData {
  logo: LogoImage | null
  siteName: string
}

export const HeaderClient: React.FC<HeaderClientProps> = ({
  logo,
  menuCta,
  navItems,
  siteName,
}) => {
  const [scrolled, setScrolled] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 30)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <header className={styles.header}>
      <div
        className={styles.surface}
        data-menu-open={desktopMenuOpen || mobileMenuOpen ? 'true' : 'false'}
        data-scrolled={scrolled ? 'true' : 'false'}
      >
        <div className={`site-container ${styles.inner}`}>
          <Link className="shrink-0 max-[1170px]:hidden" href="/">
            {logo ? (
              <Logo image={logo} loading="eager" priority="high" className="h-7 sm:h-8 lg:h-10" />
            ) : (
              <span className="text-base font-semibold tracking-tight">{siteName}</span>
            )}
          </Link>
          <HeaderNav
            logo={logo}
            menuCta={menuCta}
            navItems={navItems}
            onDesktopOpenChange={setDesktopMenuOpen}
            onMobileOpenChange={setMobileMenuOpen}
            siteName={siteName}
          />
        </div>
      </div>
    </header>
  )
}
