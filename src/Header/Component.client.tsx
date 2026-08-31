'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { selectLogo } from '@/components/Logo/selectLogo'
import type { LogoImage } from '@/components/Logo/types'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
  logo: LogoImage | null
  logoDark: LogoImage | null
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data, logo, logoDark }) => {
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  const selectedLogo = selectLogo(logo, logoDark, theme === 'dark')

  return (
    <header className="container relative z-20   " {...(theme ? { 'data-theme': theme } : {})}>
      <div className="py-8 flex justify-between">
        <Link href="/">
          <Logo
            image={selectedLogo}
            loading="eager"
            priority="high"
            className="h-7 w-auto max-w-full sm:h-8 lg:h-10"
          />
        </Link>
        <HeaderNav data={data} />
      </div>
    </header>
  )
}
