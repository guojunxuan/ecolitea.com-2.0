'use client'

import { cn } from '@/utilities/ui'
import React from 'react'

import type { Props as MediaProps } from '../types'

import {
  buildCloudflareVideoPosterURL,
  buildCloudflareVideoURL,
  isCloudflareVideoEligible,
} from '../cloudflare'
import { MEDIA_PRESENTATION_DEFAULTS } from '../config'
import { getMediaUrl } from '@/utilities/getMediaUrl'

import styles from './index.module.css'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, presentation, resource, videoClassName } = props

  if (resource && typeof resource === 'object') {
    const { durationSeconds, updatedAt, url } = resource
    if (!url) return null

    const source = getMediaUrl(url, updatedAt)
    const videoPresentation = presentation?.video
    const isAmbient =
      (videoPresentation?.playback ?? MEDIA_PRESENTATION_DEFAULTS.video.playback) === 'ambient'
    const canTransform = isCloudflareVideoEligible({ source, durationSeconds })
    const renderedSource = canTransform
      ? buildCloudflareVideoURL({ presentation: videoPresentation, source })
      : source
    const poster = canTransform
      ? buildCloudflareVideoPosterURL({ presentation: videoPresentation, source })
      : undefined

    return (
      <video
        autoPlay={isAmbient}
        className={cn(styles.video, videoClassName)}
        controls={!isAmbient}
        data-media-kind="video"
        loop={isAmbient}
        muted={isAmbient}
        onClick={onClick}
        playsInline
        poster={poster}
      >
        <source src={renderedSource} type="video/mp4" />
      </video>
    )
  }

  return null
}
