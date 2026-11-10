'use client'
import { useEffect, useRef, useState } from 'react'
import { Media } from '@/components/Media'
import type { Media as MediaResource } from '@/payload-types'
import { SegmentIndicator } from '../SegmentIndicator'
import styles from './index.module.css'

export function ProductGallery({ images }: { images: MediaResource[] }) {
  const [selectedIndex, selectImage] = useState(0)
  const activeImageIndex = Math.max(0, Math.min(selectedIndex, images.length - 1))
  const track = useRef<HTMLDivElement>(null)
  const fromScroll = useRef(false)
  useEffect(() => {
    const node = track.current
    if (!node) return
    const breakpoint = window.matchMedia('(min-width: 48rem)')
    const align = () => {
      if (!breakpoint.matches)
        node.scrollTo({ left: activeImageIndex * node.clientWidth, behavior: 'auto' })
    }
    if (fromScroll.current) fromScroll.current = false
    else align()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align)
    observer?.observe(node)
    breakpoint.addEventListener('change', align)
    return () => {
      observer?.disconnect()
      breakpoint.removeEventListener('change', align)
    }
  }, [activeImageIndex, images.length])
  if (!images.length)
    return <div className={styles.empty} role="img" aria-label="No product images" />
  return (
    <div className={styles.root}>
      <div className={styles.thumbs}>
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            aria-label={`Show image ${index + 1} of ${images.length}`}
            aria-current={activeImageIndex === index ? 'true' : undefined}
            onClick={() => selectImage(index)}
          >
            <Media
              resource={image}
              fill
              size="72px"
              imgClassName={styles.image}
              presentation={{ image: { fit: 'contain' } }}
            />
          </button>
        ))}
      </div>
      <div className={styles.main}>
        <div
          ref={track}
          className={styles.track}
          role="region"
          aria-label="Product images"
          tabIndex={0}
          onKeyDown={(event) => {
            if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault()
              selectImage(
                Math.max(
                  0,
                  Math.min(
                    images.length - 1,
                    activeImageIndex + (event.key === 'ArrowRight' ? 1 : -1),
                  ),
                ),
              )
            }
          }}
          onScroll={(event) => {
            if (window.matchMedia('(min-width: 48rem)').matches) return
            const element = event.currentTarget
            const index = Math.max(
              0,
              Math.min(
                images.length - 1,
                Math.round(element.scrollLeft / Math.max(1, element.clientWidth)),
              ),
            )
            if (index !== activeImageIndex) {
              fromScroll.current = true
              selectImage(index)
            }
          }}
        >
          {images.map((image, index) => (
            <div
              key={image.id}
              className={styles.slide}
              data-active={index === activeImageIndex}
              aria-hidden={index !== activeImageIndex}
            >
              <Media
                resource={image}
                fill
                priority={index === 0}
                size="(max-width: 767px) 100vw, 55vw"
                imgClassName={styles.image}
                presentation={{ image: { fit: 'contain' } }}
              />
            </div>
          ))}
        </div>
        <span className={styles.count} aria-live="polite">
          {activeImageIndex + 1} / {images.length}
        </span>
      </div>
      <div className={styles.segments}>
        <SegmentIndicator count={images.length} active={activeImageIndex} />
      </div>
    </div>
  )
}
