'use client'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

import { Logo } from '@/components/Logo/Logo'
import type { LogoImage } from '@/components/Logo/types'
import { HeaderNav } from './Nav'
import type { HeaderNavigationData } from './Nav/types'

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

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 0)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <header className="relative z-50 h-[var(--header-height)]">
      <div
        className={`fixed inset-x-0 top-0 bg-background transition-shadow ${
          scrolled ? 'border-b border-border shadow-sm' : ''
        }`}
        data-scrolled={scrolled ? 'true' : 'false'}
      >
        <div className="site-container flex h-[var(--header-height)] items-center justify-between gap-6">
          <Link className="shrink-0 max-[1170px]:hidden" href="/">
            {logo ? (
              <Logo image={logo} loading="eager" priority="high" className="h-7 sm:h-8 lg:h-10" />
            ) : (
              <span className="text-base font-semibold tracking-tight">{siteName}</span>
            )}
          </Link>
          <HeaderNav logo={logo} menuCta={menuCta} navItems={navItems} siteName={siteName} />
        </div>
      </div>
    </header>
  )
}
