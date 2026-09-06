'use client'
import Link from 'next/link'
import React from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import type { LogoImage } from '@/components/Logo/types'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
  logo: LogoImage | null
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data, logo }) => {
  return (
    <header className="container relative z-20   ">
      <div className="py-8 flex justify-between">
        {logo && (
          <Link className="shrink-0" href="/">
            <Logo
              image={logo}
              loading="eager"
              priority="high"
              className="h-7 sm:h-8 lg:h-10"
            />
          </Link>
        )}
        <HeaderNav data={data} />
      </div>
    </header>
  )
}
