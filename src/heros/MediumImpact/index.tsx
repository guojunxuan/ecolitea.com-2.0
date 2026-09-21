import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

export const MediumImpactHero: React.FC<Page['hero']> = ({ headerTheme, links, media, richText }) => {
  return (
    <div className="pt-[var(--section-space-standard)]">
      <HeaderThemeSync theme={headerTheme} />
      <div className="site-container mb-8">
        {richText && <RichText className="mb-6" data={richText} enableGutter={false} />}

        {Array.isArray(links) && links.length > 0 && (
          <ul className="flex gap-4">
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
      <div className="wide-container">
        {media && typeof media === 'object' && (
          <div>
            <Media
              imgClassName=""
              presentation={MEDIA_PRESENTATION.hero}
              priority
              resource={media}
            />
            {media?.caption && (
              <div className="mt-3">
                <RichText data={media.caption} enableGutter={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
