import React from 'react'

import type { Page } from '@/payload-types'

import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

import styles from './index.module.css'

type LowImpactHeroType = {
  children?: React.ReactNode
  headerTheme?: Page['hero']['headerTheme'] | null
  richText?: Page['hero']['richText']
}

export const LowImpactHero: React.FC<LowImpactHeroType> = ({ children, headerTheme, richText }) => {
  return (
    <div className={styles.root} data-hero="low-impact">
      <HeaderThemeSync theme={headerTheme} />
      <div className={styles.content}>
        {children || (richText && <RichText data={richText} enableGutter={false} />)}
      </div>
    </div>
  )
}
