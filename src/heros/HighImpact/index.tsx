import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

import styles from './index.module.css'

export const HighImpactHero: React.FC<Page['hero']> = ({ headerTheme, links, media, richText }) => {
  return (
    <div className={styles.root} data-hero="high-impact">
      <HeaderThemeSync theme={headerTheme} />
      <div className={styles.content}>
        <div className={styles.intro}>
          {richText && (
            <RichText
              className={`${styles.richText} payload-richtext--inverse`}
              data={richText}
              enableGutter={false}
            />
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className={styles.links}>
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <div className={styles.mediaFrame}>
        {media && typeof media === 'object' && (
          <Media
            fill
            imgClassName={styles.image}
            presentation={MEDIA_PRESENTATION.hero}
            priority
            resource={media}
          />
        )}
      </div>
    </div>
  )
}
