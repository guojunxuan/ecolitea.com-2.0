'use client'
import React, { useEffect, useRef } from 'react'
import { Media } from '@/components/Media'
import { useProductSelection } from '../ProductSelection'
import { SegmentIndicator } from '../SegmentIndicator'
import styles from './index.module.css'

export function ProductGallery() {
  const { product, activeImageIndex, selectImage } = useProductSelection()
  const track = useRef<HTMLDivElement>(null)
  const fromScroll = useRef(false)
  useEffect(() => {
    const node = track.current
    const breakpoint = window.matchMedia('(min-width: 48rem)')
    const align = () => {
      if (node && !breakpoint.matches)
        node.scrollTo({ left: activeImageIndex * node.clientWidth, behavior: 'auto' })
    }
    if (fromScroll.current) fromScroll.current = false
    else align()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align)
    if (node) observer?.observe(node)
    breakpoint.addEventListener('change', align)
    return () => {
      observer?.disconnect()
      breakpoint.removeEventListener('change', align)
    }
  }, [activeImageIndex])
  if (!product.gallery.length)
    return <div className={styles.empty} aria-label="No product images" />
  return (
    <div className={styles.root}>
      <div className={styles.thumbs}>
        {product.gallery.map((item, index) => (
          <button
            key={item.media.id}
            type="button"
            aria-label={`Show image ${index + 1} of ${product.gallery.length}`}
            aria-current={activeImageIndex === index ? 'true' : undefined}
            onClick={() => selectImage(index)}
          >
            <Media
              resource={item.media}
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
                    product.gallery.length - 1,
                    activeImageIndex + (event.key === 'ArrowRight' ? 1 : -1),
                  ),
                ),
              )
            }
          }}
          onScroll={(event) => {
            if (window.matchMedia('(min-width: 48rem)').matches) return
            const element = event.currentTarget
            const index = Math.round(element.scrollLeft / Math.max(1, element.clientWidth))
            if (index !== activeImageIndex) {
              fromScroll.current = true
              selectImage(index)
            }
          }}
        >
          {product.gallery.map((item, index) => (
            <div
              key={item.media.id}
              className={styles.slide}
              data-active={index === activeImageIndex}
              aria-hidden={index !== activeImageIndex}
            >
              <Media
                resource={item.media}
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
          {activeImageIndex + 1} / {product.gallery.length}
        </span>
      </div>
      <div className={styles.segments}>
        <SegmentIndicator count={product.gallery.length} active={activeImageIndex} />
      </div>
    </div>
  )
}
