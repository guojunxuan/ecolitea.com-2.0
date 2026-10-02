import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'
import { MEDIA_PRESENTATION } from '../../components/Media/config'
import styles from './Component.module.css'

type Props = MediaBlockProps & {
  breakout?: boolean
  captionClassName?: string
  className?: string
  enableGutter?: boolean
  imgClassName?: string
  staticImage?: StaticImageData
  disableInnerContainer?: boolean
  context?: 'page' | 'article'
}

export const MediaBlock: React.FC<Props> = (props) => {
  const {
    caption: blockCaption,
    width = 'default',
    captionClassName,
    className,
    enableGutter = true,
    imgClassName,
    media,
    staticImage,
    disableInnerContainer,
    context = 'page',
  } = props

  const caption = blockCaption ?? (media && typeof media === 'object' ? media.caption : undefined)

  return (
    <figure
      data-width={width || 'default'}
      className={cn(
        styles.figure,
        context === 'article' && styles.article,
        width === 'wide' && styles.wide,
        {
          [styles.container]: enableGutter,
        },
        className,
      )}
    >
      {(media || staticImage) && (
        <Media
          imgClassName={cn(styles.image, imgClassName)}
          presentation={MEDIA_PRESENTATION.body}
          resource={media}
          src={staticImage}
        />
      )}
      {caption && (
        <figcaption
          className={cn(
            styles.caption,
            {
              [styles.container]: !disableInnerContainer,
            },
            captionClassName,
          )}
        >
          <RichText data={caption} enableGutter={false} />
        </figcaption>
      )}
    </figure>
  )
}
