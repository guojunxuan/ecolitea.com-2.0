'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { ProductMediaCarouselBlock } from '@/payload-types'
import { SegmentIndicator } from '@/components/Products/SegmentIndicator'
import { ActiveMedia } from '../shared/ActiveMedia'
import { MediaArrow } from '../shared/MediaArrow'
import { useMediaQuery } from '../shared/useMediaQuery'
import styles from './Component.module.css'

type Props = {
  slides: NonNullable<ProductMediaCarouselBlock['slides']>
  aspectRatio: string
  label: string
}
const subscribeToHydration = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false
const subscribeVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}
const visibleSnapshot = () => document.visibilityState !== 'hidden'

export function Carousel({ slides, aspectRatio, label }: Props) {
  const [selectedIndex, setActive] = useState(0)
  const active = Math.max(0, Math.min(selectedIndex, slides.length - 1))
  const [stopped, setStopped] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [intersecting, setInViewport] = useState(false)
  const pageVisible = useSyncExternalStore(subscribeVisibility, visibleSnapshot, serverSnapshot)
  const [progress, setProgress] = useState(0)
  const elapsed = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const count = slides.length
  const captionId = useId()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', true)
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot)
  const inViewport = intersecting || (hydrated && typeof IntersectionObserver === 'undefined')
  const loop = count > 1 && hydrated
  const entries = loop ? [slides[count - 1], ...slides, slides[0]] : slides
  const currentMedia = slides[active]?.media
  const isVideo = typeof currentMedia === 'object' && currentMedia?.mimeType?.startsWith('video/')
  const running =
    loop && !reducedMotion && inViewport && pageVisible && !stopped && !hovered && !focused
  const scroll = useCallback(
    (position: number, smooth = false) => {
      const element = track.current
      const child = element?.children[position] as HTMLElement | undefined
      if (!element || !child) return
      element.scrollTo?.({
        left: child.offsetLeft - (element.clientWidth - child.clientWidth) / 2,
        behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
      })
    },
    [reducedMotion],
  )
  useLayoutEffect(() => {
    const element = track.current
    if (!element) return
    element.dataset.positioning = 'true'
    scroll(Number(element.dataset.current || 0) + (loop ? 1 : 0))
    const frame = requestAnimationFrame(() => {
      delete element.dataset.positioning
    })
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            scroll(Number(element.dataset.current || 0) + (loop ? 1 : 0))
          })
    observer?.observe(element)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [count, loop, scroll])
  useEffect(() => {
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting), {
            threshold: 0.25,
          })
    if (root.current) observer?.observe(root.current)
    return () => {
      observer?.disconnect()
    }
  }, [])
  const changeActive = useCallback(
    (index: number) => {
      if (active !== index) {
        elapsed.current = 0
        setProgress(0)
      }
      setActive(index)
    },
    [active],
  )
  const move = useCallback(
    (delta: number) => {
      if (!loop) return
      scroll(active + delta + 1, true)
      changeActive((active + delta + count) % count)
    },
    [active, count, loop, scroll, changeActive],
  )
  useEffect(() => {
    if (!running || isVideo) return
    let previous = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      elapsed.current += now - previous
      previous = now
      setProgress(Math.min(1, elapsed.current / 5000))
      if (elapsed.current >= 5000) {
        clearInterval(timer)
        move(1)
      }
    }, 50)
    return () => clearInterval(timer)
  }, [running, isVideo, active, move])
  const interact = () => setStopped(true)
  const onScroll = () => {
    const element = track.current
    if (!element || !element.clientWidth || element.dataset.positioning) return
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
    changeActive(real)
    const child = children[closest]
    if (
      loop &&
      Math.abs(child.offsetLeft + child.clientWidth / 2 - center) < 2 &&
      (closest === 0 || closest === count + 1)
    )
      scroll(real + 1)
  }
  const caption = slides[active]?.caption
  return (
    <div
      ref={root}
      className={styles.carousel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div
        ref={track}
        className={styles.track}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={0}
        data-current={active}
        onScroll={onScroll}
        onPointerDown={interact}
        onTouchStart={interact}
        onWheel={(event) => {
          if (event.deltaX !== 0 || event.shiftKey) interact()
        }}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            !['ArrowLeft', 'ArrowRight'].includes(event.key)
          )
            return
          event.preventDefault()
          interact()
          move(event.key === 'ArrowLeft' ? -1 : 1)
        }}
      >
        {entries.map((slide, position) => {
          const index = loop ? position - 1 : position
          const current = index === active
          const clone = loop && (position === 0 || position === count + 1)
          return (
            <figure
              key={clone ? `clone-${position}` : slide.id || `slide-${index}`}
              className={styles.slide}
              data-active={current}
              data-visual-active={current || (clone && (index + count) % count === active)}
              data-clone={clone || undefined}
              aria-hidden={!current}
              inert={!current}
              role="group"
              aria-roledescription="slide"
              aria-label={`${((index + count) % count) + 1} of ${count}`}
              aria-describedby={current && caption ? captionId : undefined}
            >
              <ActiveMedia
                resource={slide.media}
                className={styles.media}
                aspectRatio={aspectRatio}
                mobileAspectRatio={aspectRatio === '21:9' ? '16:9' : undefined}
                playback={slide.playback}
                active={
                  current &&
                  pageVisible &&
                  inViewport &&
                  !clone &&
                  (!isVideo || stopped || (!hovered && !focused))
                }
                loop={current && !stopped ? false : undefined}
                onEnded={current && running ? () => move(1) : undefined}
                onProgress={
                  current && running
                    ? (time, duration) => {
                        if (Number.isFinite(duration) && duration > 0)
                          setProgress(Math.min(1, Math.max(0, time / duration)))
                      }
                    : undefined
                }
              />
              {!hydrated && slide.caption && (
                <figcaption id={current ? captionId : undefined} className="website-type-body-sm">
                  {slide.caption}
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
      {loop && (
        <div className={styles.controls}>
          <p id={captionId} key={active} className={`website-type-body-sm ${styles.caption}`}>
            {caption || '\u00a0'}
          </p>
          <div className={styles.actions}>
            <SegmentIndicator
              count={count}
              active={active}
              progress={stopped || reducedMotion ? undefined : progress}
              paused={!running}
              onSelect={(index) => {
                interact()
                scroll(index + 1, true)
                changeActive(index)
              }}
            />
            <button
              type="button"
              className={styles.playback}
              aria-label={stopped ? 'Play slideshow' : 'Pause slideshow'}
              onClick={() => {
                setStopped(!stopped)
                if (stopped) {
                  elapsed.current = 0
                  setProgress(0)
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden="true"
              >
                {stopped ? <path d="m8 5 11 7-11 7Z" /> : <path d="M6 5h4v14H6zm8 0h4v14h-4z" />}
              </svg>
            </button>
            <MediaArrow
              direction="previous"
              aria-label="Previous slide"
              onClick={() => {
                interact()
                move(-1)
              }}
            />
            <MediaArrow
              direction="next"
              aria-label="Next slide"
              onClick={() => {
                interact()
                move(1)
              }}
            />
          </div>
        </div>
      )}
      <span className={styles.srOnly} role="status" aria-live={stopped ? 'polite' : 'off'}>
        Slide {active + 1} of {count}
      </span>
    </div>
  )
}
