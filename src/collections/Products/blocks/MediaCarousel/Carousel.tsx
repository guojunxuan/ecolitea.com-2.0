'use client'

import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ProductMediaCarouselBlock } from '@/payload-types'
import { SegmentIndicator } from '@/components/Products/SegmentIndicator'
import { ActiveMedia } from '../shared/ActiveMedia'
import styles from './Component.module.css'

type Props = {
  slides: NonNullable<ProductMediaCarouselBlock['slides']>
  aspectRatio: string
  label: string
}
const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function Carousel({ slides, aspectRatio, label }: Props) {
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const count = slides.length
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const loop = count > 1 && hydrated
  const entries = loop ? [slides[count - 1], ...slides, slides[0]] : slides
  const scroll = (position: number, smooth = false) => {
    const element = track.current
    const child = element?.children[position] as HTMLElement | undefined
    if (!element || !child) return
    const left = child.offsetLeft - (element.clientWidth - child.clientWidth) / 2
    const behavior =
      smooth && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
    element.scrollTo?.({ left, behavior })
  }
  useLayoutEffect(() => {
    scroll(loop ? 1 : 0)
    // Recenter the current slide after the responsive track changes width.
    const element = track.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const current = Number(element.dataset.current || 0)
      scroll(current + (loop ? 1 : 0))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [count, loop])
  const move = (delta: number) => {
    if (!loop) return
    const next = (active + delta + count) % count
    scroll(active + delta + 1, true)
    setActive(next)
  }
  const onScroll = () => {
    const element = track.current
    if (!element || !element.clientWidth) return
    const center = element.scrollLeft + element.clientWidth / 2
    const children = Array.from(element.children) as HTMLElement[]
    let closest = 0
    children.forEach((child, index) => {
      if (
        Math.abs(child.offsetLeft + child.clientWidth / 2 - center) <
        Math.abs(children[closest].offsetLeft + children[closest].clientWidth / 2 - center)
      )
        closest = index
    })
    const real = loop ? (closest - 1 + count) % count : closest
    setActive(real)
    const child = children[closest]
    const centered = Math.abs(child.offsetLeft + child.clientWidth / 2 - center) < 2
    if (loop && centered && (closest === 0 || closest === count + 1)) scroll(real + 1)
  }
  return (
    <div className={styles.carousel}>
      <div
        ref={track}
        className={styles.track}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        data-current={active}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            !['ArrowLeft', 'ArrowRight'].includes(event.key)
          )
            return
          event.preventDefault()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }}
      >
        {entries.map((slide, position) => {
          const index = loop ? position - 1 : position
          const current = index === active
          return (
            <figure
              key={`${slide.id || index}-${position}`}
              className={styles.slide}
              data-active={current}
              aria-hidden={!current}
              inert={!current}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}`}
            >
              <ActiveMedia
                resource={slide.media}
                aspectRatio={aspectRatio}
                playback={slide.playback}
                active={current}
              />
              {slide.caption && (
                <figcaption className="website-type-body-md">{slide.caption}</figcaption>
              )}
            </figure>
          )
        })}
      </div>
      {loop && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => move(-1)}
            aria-label="Previous slide"
          >
            ←
          </button>
          <SegmentIndicator count={count} active={active} />
          <button
            type="button"
            className={styles.arrow}
            onClick={() => move(1)}
            aria-label="Next slide"
          >
            →
          </button>
        </div>
      )}
      <span className={styles.srOnly} role="status" aria-live="polite">
        Slide {active + 1} of {count}
      </span>
    </div>
  )
}
