'use client'

import React, { useEffect, useRef } from 'react'
import { Media } from '@/components/Media'
import type { Media as MediaType } from '@/payload-types'
import { resolveProductAspectRatio } from './aspectRatio'
import styles from './ProductMedia.module.css'
import { useMediaQuery } from './useMediaQuery'

export type ProductMediaProps = {
  resource?: string | MediaType | null
  mobileResource?: string | MediaType | null
  aspectRatio?: string | null
  mobileAspectRatio?: string | null
  playback?: 'ambient' | 'player'
  className?: string
  active?: boolean
  fit?: 'cover' | 'contain'
  loop?: boolean
  onEnded?: () => void
  onProgress?: (currentTime: number, duration: number) => void
}

export function ProductMedia({
  resource,
  mobileResource,
  aspectRatio,
  mobileAspectRatio,
  playback = 'ambient',
  className,
  active = true,
  fit,
  loop,
  onEnded,
  onProgress,
}: ProductMediaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', true)
  useEffect(() => {
    ref.current?.querySelectorAll('video').forEach((video) => {
      if (!active || (reducedMotion && playback === 'ambient')) video.pause()
      else if (playback === 'ambient') void video.play()?.catch(() => undefined)
    })
  }, [active, playback, reducedMotion, resource])
  useEffect(() => {
    const videos = Array.from(ref.current?.querySelectorAll('video') ?? [])
    const report = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement
      onProgress?.(video.currentTime, video.duration)
    }
    const ended = () => onEnded?.()
    videos.forEach((video) => {
      video.loop = loop ?? playback === 'ambient'
      video.addEventListener('ended', ended)
      video.addEventListener('timeupdate', report)
    })
    return () =>
      videos.forEach((video) => {
        video.removeEventListener('ended', ended)
        video.removeEventListener('timeupdate', report)
      })
  }, [resource, playback, loop, onEnded, onProgress])
  const ratio = resolveProductAspectRatio(aspectRatio)
  const mobileRatio = resolveProductAspectRatio(mobileAspectRatio)
  let mobileImage: MediaType | undefined
  if (mobileRatio && typeof resource === 'object' && resource?.mimeType?.startsWith('image/')) {
    mobileImage = resource
  }
  if (typeof mobileResource === 'object' && mobileResource?.mimeType?.startsWith('image/')) {
    mobileImage = mobileResource
  }
  return (
    <div
      ref={ref}
      className={[styles.frame, className].filter(Boolean).join(' ')}
      data-aspect-ratio={aspectRatio ?? 'original'}
      data-mobile-aspect-ratio={mobileRatio ? mobileAspectRatio : undefined}
      style={
        {
          ...(ratio ? { '--product-aspect-ratio': `${ratio.width} / ${ratio.height}` } : {}),
          ...(mobileRatio
            ? { '--product-mobile-aspect-ratio': `${mobileRatio.width} / ${mobileRatio.height}` }
            : {}),
          ...(fit ? { '--product-media-fit': fit } : {}),
        } as React.CSSProperties
      }
    >
      <Media
        resource={resource}
        mobileResource={mobileImage}
        paused={!active || (reducedMotion && playback === 'ambient')}
        presentation={{
          image: {
            aspectRatio: ratio,
            mobileAspectRatio: mobileRatio,
            fit: fit ?? (ratio ? 'cover' : 'contain'),
          },
          video: {
            playback,
            fit: ratio ? 'cover' : 'contain',
          },
        }}
        imgClassName={styles.media}
        videoClassName={styles.media}
        pictureClassName={styles.picture}
      />
    </div>
  )
}
