import { getCachedGlobal } from '@/utilities/getGlobals'
import Link from 'next/link'
import React from 'react'

import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { selectLogo } from '@/components/Logo/selectLogo'

export async function Footer() {
  const [footerData, siteSettings] = await Promise.all([
    getCachedGlobal('footer', 1)(),
    getCachedGlobal('site-settings', 1)(),
  ])

  const navItems = footerData?.navItems || []
  const logo = selectLogo(
    resolveBrandAsset(siteSettings.logo),
    resolveBrandAsset(siteSettings.logoDark),
    true,
  )

  return (
    <footer className="mt-auto border-t border-border bg-black dark:bg-card text-white">
      <div className="container py-8 gap-8 flex flex-col md:flex-row md:justify-between">
        {logo && (
          <Link className="flex items-center" href="/">
            <Logo image={logo} className="h-7 sm:h-8 lg:h-10" />
          </Link>
        )}

        <div className="flex flex-col-reverse items-start md:flex-row gap-4 md:items-center">
          <ThemeSelector />
          <nav className="flex flex-col md:flex-row gap-4">
            {navItems.map(({ link }, i) => {
              return <CMSLink className="text-white" key={i} {...link} />
            })}
          </nav>
        </div>
      </div>
    </footer>
  )
}
