'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { CMSLink } from '@/components/Link'
import { SlideMedia } from './SlideMedia'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import type { ProductHeroSlide } from '@/utilities/products/getProductListingHero'

import styles from './index.module.css'

const AUTOPLAY_MS = 4000
const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia(motionQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
const reducedMotion = () => window.matchMedia(motionQuery).matches
const subscribeVisibility = (callback: () => void) => {
  document.addEventListener('visibilitychange', callback)
  return () => document.removeEventListener('visibilitychange', callback)
}
const pageHidden = () => document.hidden
const serverFalse = () => false
const websiteTheme = (theme: ProductHeroSlide['theme']) => (theme === 'dark' ? 'inverse' : 'default')

export const ProductListingHero: React.FC<{ slides: ProductHeroSlide[] }> = ({ slides }) => {
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const pointerFocus = useRef(false)
  const suppressLinkClick = useRef(false)
  const reduceMotion = useSyncExternalStore(subscribeMotion, reducedMotion, serverFalse)
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, serverFalse)
  const gesture = useRef<{ id: number; x: number; y: number; horizontal: boolean } | null>(null)
  const count = slides.length
  const index = count ? active % count : 0
  const paused = hovered || focused || interacting || hidden || reduceMotion
  const cancelGesture = (pointerId: number) => {
    if (gesture.current?.id !== pointerId) return
    gesture.current = null
    setInteracting(false)
  }
  const go = useCallback(
    (delta: number) => {
      if (count > 1) setActive((value) => (value + delta + count) % count)
    },
    [count],
  )

  useEffect(() => {
    if (count < 2 || paused) return
    const timer = window.setTimeout(() => go(1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [index, count, go, paused])

  const current = slides[index]
  if (!current) return null

  return (
    <section
      className={styles.root}
      data-hero="product-listing"
      data-website-theme={websiteTheme(current.theme)}
      data-keyboard-focus={focused || undefined}
      style={{ '--hero-autoplay': `${AUTOPLAY_MS}ms` } as React.CSSProperties}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured products"
      tabIndex={0}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return
        setHovered(false)
        if (!event.currentTarget.hasPointerCapture?.(event.pointerId))
          cancelGesture(event.pointerId)
      }}
      onPointerDownCapture={(event) => {
        suppressLinkClick.current = false
        pointerFocus.current = true
        setFocused(false)
        if (!event.isPrimary) {
          gesture.current = null
          setInteracting(false)
          return
        }
        if (
          event.button !== 0 ||
          (event.target instanceof Element && event.target.closest('button'))
        )
          return
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          horizontal: false,
        }
        setInteracting(true)
      }}
      onPointerMove={(event) => {
        const start = gesture.current
        if (!start || start.id !== event.pointerId || start.horizontal) return
        const x = Math.abs(event.clientX - start.x)
        const y = Math.abs(event.clientY - start.y)
        if (Math.max(x, y) < 10) return
        if (y >= x) {
          cancelGesture(event.pointerId)
          return
        }
        start.horizontal = true
        suppressLinkClick.current = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }}
      onPointerUp={(event) => {
        const start = gesture.current
        if (!start || start.id !== event.pointerId) return
        cancelGesture(event.pointerId)
        const delta = event.clientX - start.x
        if (Math.abs(delta) >= 50 && Math.abs(delta) > Math.abs(event.clientY - start.y)) {
          suppressLinkClick.current = true
          go(delta < 0 ? 1 : -1)
        }
      }}
      onPointerCancel={(event) => cancelGesture(event.pointerId)}
      onLostPointerCapture={(event) => cancelGesture(event.pointerId)}
      onDragStart={(event) => event.preventDefault()}
      onKeyDownCapture={() => {
        suppressLinkClick.current = false
        pointerFocus.current = false
        setFocused(true)
      }}
      onFocusCapture={() => {
        if (!pointerFocus.current) setFocused(true)
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          pointerFocus.current = false
          setFocused(false)
        }
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault()
          go(event.key === 'ArrowLeft' ? -1 : 1)
        }
      }}
      onClickCapture={(event) => {
        // A swipe can be followed by a synthetic click on the image link.
        if (
          suppressLinkClick.current &&
          event.target instanceof Element &&
          event.target.closest('a')
        ) {
          event.preventDefault()
          event.stopPropagation()
        }
        suppressLinkClick.current = false
      }}
    >
      <HeaderThemeSync theme={current.theme} />
      {slides.map((slide, slideIndex) => {
        const isActive = slideIndex === index
        return (
          <div
            key={slide.id}
            className={styles.slide}
            data-active={isActive || undefined}
            data-website-theme={websiteTheme(slide.theme)}
            role="group"
            aria-roledescription="slide"
            aria-label={`${slideIndex + 1} / ${count}`}
            aria-hidden={!isActive}
            inert={!isActive}
            style={
              {
                '--hero-focal-point': `${slide.media?.focalX ?? 50}% ${slide.media?.focalY ?? 50}%`,
                '--hero-mobile-focal-point': `${(slide.mobileMedia ?? slide.media)?.focalX ?? 50}% ${(slide.mobileMedia ?? slide.media)?.focalY ?? 50}%`,
              } as React.CSSProperties
            }
          >
            <div className={styles.mediaFrame} aria-hidden="true">
              <SlideMedia
                slide={slide}
                priority={slideIndex === 0}
                allowVideo={isActive || slideIndex === (index + 1) % count}
                paused={!isActive || paused}
              />
            </div>
            {slide.cta && (
              <CMSLink {...slide.cta} appearance="inline" className={styles.slideLink} label={null}>
                <span className="visually-hidden">{slide.cta.label || slide.title}</span>
              </CMSLink>
            )}
            {slide.showText && (
              <div className={styles.content}>
                <div className={styles.copy}>
                  <h2 className={styles.title}>{slide.title}</h2>
                  {slide.description && <p className={styles.description}>{slide.description}</p>}
                </div>
              </div>
            )}
          </div>
        )
      })}
      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            aria-label="Previous slide"
            onClick={() => go(-1)}
          >
            <ChevronLeft strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Next slide"
            onClick={() => go(1)}
          >
            <ChevronRight strokeWidth={1.5} aria-hidden="true" />
          </button>
          <div className={styles.controls}>
            <div className={styles.dots}>
              {slides.map((slide, slideIndex) => (
                <button
                  key={slide.id}
                  type="button"
                  className={styles.dot}
                  data-active={slideIndex === index || undefined}
                  data-paused={paused || undefined}
                  aria-label={`Go to slide ${slideIndex + 1}`}
                  aria-current={slideIndex === index || undefined}
                  onClick={() => setActive(slideIndex)}
                >
                  <span className={styles.segment}>
                    {slideIndex === index && (
                      <span
                        key={`${index}-${paused ? 'paused' : 'running'}`}
                        data-hero-progress
                        data-running={!paused || undefined}
                        className={styles.progress}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
