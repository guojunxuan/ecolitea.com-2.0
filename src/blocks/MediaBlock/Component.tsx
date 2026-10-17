import type { StaticImageData } from 'next/image'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { MediaBlock as MediaBlockProps } from '@/payload-types'

import { Media } from '../../components/Media'
import { MEDIA_PRESENTATION } from '../../components/Media/config'
import styles from './Component.module.css'
import { resolveMediaAspectRatio } from './aspectRatio'

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
    aspectRatio,
    playback,
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

  const ratio = resolveMediaAspectRatio(aspectRatio)
  const presentation = {
    ...MEDIA_PRESENTATION.body,
    ...(ratio && {
      image: { ...MEDIA_PRESENTATION.body.image, aspectRatio: ratio, fit: 'cover' as const },
    }),
    video: { playback: playback ?? 'ambient' },
  }

  return (
    <figure
      data-width={width || 'default'}
      data-aspect-ratio={aspectRatio || 'original'}
      style={
        ratio
          ? ({ '--media-aspect-ratio': `${ratio.width} / ${ratio.height}` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        styles.figure,
        context === 'article' && styles.article,
        context === 'article' && Boolean(aspectRatio) && styles.fullWidth,
        width === 'wide' && styles.wide,
        {
          [styles.container]: enableGutter,
        },
        className,
      )}
    >
      {(media || staticImage) && (
        <Media
          className={ratio ? styles.crop : undefined}
          videoClassName={styles.image}
          imgClassName={cn(styles.image, imgClassName)}
          presentation={presentation}
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
