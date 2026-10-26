'use client'

import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { Media } from '@/components/Media'
import type { Media as MediaType } from '@/payload-types'
import { resolveProductAspectRatio } from './aspectRatio'
import styles from './ProductMedia.module.css'

export type ProductMediaProps = {
  resource?: string | MediaType | null
  aspectRatio?: string | null
  playback?: 'ambient' | 'player'
  className?: string
  active?: boolean
}

const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribeToMotion = (listener: () => void) => {
  const query = window.matchMedia?.(motionQuery)
  query?.addEventListener('change', listener)
  return () => query?.removeEventListener('change', listener)
}
const prefersReducedMotion = () => window.matchMedia?.(motionQuery).matches ?? false
// The server cannot know the visitor's preference. Keep ambient video paused
// until hydration confirms that animation is appropriate.
const serverReducedMotion = () => true

export function ProductMedia({
  resource,
  aspectRatio,
  playback = 'ambient',
  className,
  active = true,
}: ProductMediaProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    prefersReducedMotion,
    serverReducedMotion,
  )
  useEffect(() => {
    ref.current?.querySelectorAll('video').forEach((video) => {
      if (!active || (reducedMotion && playback === 'ambient')) video.pause()
      else if (playback === 'ambient') void video.play()?.catch(() => undefined)
    })
  }, [active, playback, reducedMotion, resource])
  const ratio = resolveProductAspectRatio(aspectRatio)
  return (
    <div
      ref={ref}
      className={[styles.frame, className].filter(Boolean).join(' ')}
      data-aspect-ratio={aspectRatio ?? 'original'}
      style={
        ratio
          ? ({
              '--product-aspect-ratio': `${ratio.width} / ${ratio.height}`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <Media
        resource={resource}
        presentation={{
          image: { aspectRatio: ratio, fit: ratio ? 'cover' : 'contain' },
          video: {
            playback: active && !reducedMotion ? playback : 'player',
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
