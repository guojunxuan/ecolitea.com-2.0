'use client'

import { cn } from '@/utilities/ui'
import React, { useEffect, useRef } from 'react'

import type { Props as MediaProps } from '../types'

import { buildCloudflareVideoURL } from '../cloudflare'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, presentation, resource, videoClassName } = props

  const videoRef = useRef<HTMLVideoElement>(null)
  // const [showFallback] = useState<boolean>()

  useEffect(() => {
    const { current: video } = videoRef
    if (video) {
      video.addEventListener('suspend', () => {
        // setShowFallback(true);
        // console.warn('Video was suspended, rendering fallback image.')
      })
    }
  }, [])

  if (resource && typeof resource === 'object') {
    const { durationSeconds, updatedAt, url } = resource
    if (!url) return null

    const source = getMediaUrl(url, updatedAt)
    const canTransform =
      typeof durationSeconds === 'number' &&
      Number.isFinite(durationSeconds) &&
      durationSeconds > 0 &&
      durationSeconds <= 60
    const renderedSource = canTransform
      ? buildCloudflareVideoURL({ presentation: presentation?.video, source })
      : source

    return (
      <video
        autoPlay
        className={cn(videoClassName)}
        controls={false}
        loop
        muted
        onClick={onClick}
        playsInline
        ref={videoRef}
      >
        <source src={renderedSource} />
      </video>
    )
  }

  return null
}
