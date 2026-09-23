import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

import styles from './index.module.css'

export const MediumImpactHero: React.FC<Page['hero']> = ({
  headerTheme,
  links,
  media,
  richText,
}) => {
  return (
    <div className={styles.root} data-hero="medium-impact">
      <HeaderThemeSync theme={headerTheme} />
      <div className={styles.content}>
        {richText && <RichText className={styles.richText} data={richText} enableGutter={false} />}

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
      <div className={styles.mediaContainer}>
        {media && typeof media === 'object' && (
          <div>
            <Media
              imgClassName=""
              presentation={MEDIA_PRESENTATION.hero}
              priority
              resource={media}
            />
            {media?.caption && (
              <div className={styles.caption}>
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
