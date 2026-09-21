import React from 'react'

import type { Page } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import RichText from '@/components/RichText'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'

export const HighImpactHero: React.FC<Page['hero']> = ({ headerTheme, links, media, richText }) => {
  return (
    <div className="relative flex items-center justify-center bg-black text-white">
      <HeaderThemeSync theme={headerTheme} />
      <div className="container mb-8 z-10 relative flex items-center justify-center">
        <div className="max-w-[36.5rem] md:text-center">
          {richText && (
            <RichText className="mb-6 prose-invert" data={richText} enableGutter={false} />
          )}
          {Array.isArray(links) && links.length > 0 && (
            <ul className="flex md:justify-center gap-4">
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
      <div className="min-h-[80vh] select-none">
        {media && typeof media === 'object' && (
          <Media
            fill
            imgClassName="-z-10 object-cover"
            presentation={MEDIA_PRESENTATION.hero}
            priority
            resource={media}
          />
        )}
      </div>
    </div>
  )
}
