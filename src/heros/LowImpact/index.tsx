import React from 'react'

import type { Page } from '@/payload-types'

import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

type LowImpactHeroType = {
  children?: React.ReactNode
  headerTheme?: Page['hero']['headerTheme'] | null
  richText?: Page['hero']['richText']
}

export const LowImpactHero: React.FC<LowImpactHeroType> = ({ children, headerTheme, richText }) => {
  return (
    <div className="site-container pt-[var(--section-space-standard)]">
      <HeaderThemeSync theme={headerTheme} />
      <div className="max-w-[48rem]">
        {children || (richText && <RichText data={richText} enableGutter={false} />)}
      </div>
    </div>
  )
}
