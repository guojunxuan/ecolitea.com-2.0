'use client'

import { cn } from '@/utilities/ui'
import React, { useEffect, useRef } from 'react'

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
  const { onClick, paused, presentation, resource, videoClassName, videoSourceMedia } = props
  const video = useRef<HTMLVideoElement>(null)
  const isAmbient =
    (presentation?.video?.playback ?? MEDIA_PRESENTATION_DEFAULTS.video.playback) === 'ambient'

  useEffect(() => {
    const element = video.current
    if (!element || !isAmbient || paused === undefined) return
    if (paused) element.pause()
    else void element.play().catch(() => {})
  }, [isAmbient, paused, resource])

  if (resource && typeof resource === 'object') {
    const { durationSeconds, updatedAt, url } = resource
    if (!url) return null

    const source = getMediaUrl(url, updatedAt)
    const videoPresentation = presentation?.video
    const canTransform = isCloudflareVideoEligible({ source, durationSeconds })
    const renderedSource = canTransform
      ? buildCloudflareVideoURL({ presentation: videoPresentation, source })
      : source
    const poster = canTransform
      ? buildCloudflareVideoPosterURL({ presentation: videoPresentation, source })
      : undefined

    return (
      <video
        ref={video}
        autoPlay={isAmbient && paused !== true}
        className={cn(styles.video, videoClassName)}
        controls={!isAmbient}
        data-media-kind="video"
        loop={isAmbient}
        muted={isAmbient}
        onClick={onClick}
        playsInline
        poster={poster}
      >
        <source src={renderedSource} type="video/mp4" media={videoSourceMedia} />
      </video>
    )
  }

  return null
}
