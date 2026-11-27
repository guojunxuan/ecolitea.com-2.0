'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  scrollBehavior,
  useOverflowTrack,
} from '@/components/Products/OverflowCarousel/useOverflowTrack'

import styles from './index.module.css'

type AnchorItem = { id: string; label: string }

export const AnchorNav = ({
  items,
  variant,
  revealAfter,
}: {
  items: AnchorItem[]
  variant: 'category' | 'detail'
  revealAfter?: string
}) => {
  const navigation = useRef<HTMLElement>(null)
  const [active, setActive] = useState(items[0]?.id ?? '')
  const [stuck, setStuck] = useState(false)
  const { ref, edges, scroll } = useOverflowTrack(0.6)

  useEffect(() => {
    const targets = items.flatMap(({ id }) => {
      const target = document.getElementById(id)
      return target ? [target] : []
    })
    const previousMargins = targets.map((target) => target.style.scrollMarginTop)
    let frame = 0
    let spy = () => {}
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        spy()
      })
    }
    let observer: IntersectionObserver | undefined
    let boundaryObserver: IntersectionObserver | undefined
    const setup = () => {
      observer?.disconnect()
      boundaryObserver?.disconnect()
      if (!navigation.current) return
      const measured = getComputedStyle(navigation.current)
      const header = Number.parseFloat(measured.top) || 0
      const navHeight = Number.parseFloat(measured.height) || 0
      const space =
        variant === 'detail'
          ? 0
          : Number.parseFloat(measured.getPropertyValue('--website-space-4')) || 0
      targets.forEach((target) => {
        target.style.scrollMarginTop =
          variant === 'detail'
            ? `${header + navHeight}px`
            : 'calc(var(--header-height) + var(--website-anchor-nav-height) + var(--website-space-4))'
      })
      const boundaryId = revealAfter ?? (variant === 'detail' ? 'overview' : undefined)
      const boundary = boundaryId ? document.getElementById(boundaryId) : null
      const updateStuck = (bottom = boundary?.getBoundingClientRect().bottom) => {
        if (bottom != null) setStuck(bottom <= header + (variant === 'detail' ? 1 : 0))
        else if (revealAfter) setStuck(true)
      }
      updateStuck()
      spy = () => {
        updateStuck()
        const offset = header + navHeight + space
        const passed = targets.filter((target) => target.getBoundingClientRect().top <= offset + 1)
        const current =
          passed.at(-1) ??
          targets.find((target) => target.getBoundingClientRect().top < window.innerHeight * 0.5)
        if (current) setActive(current.id)
      }
      if (typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver(spy, {
        rootMargin: `-${header + navHeight}px 0px -55% 0px`,
        threshold: 0,
      })
      targets.forEach((target) => observer?.observe(target))
      if (boundary) {
        boundaryObserver = new IntersectionObserver(
          ([entry]) => {
            if (entry) updateStuck(entry.boundingClientRect.bottom)
          },
          { rootMargin: `-${header}px 0px 0px 0px`, threshold: 0 },
        )
        boundaryObserver.observe(boundary)
      }
    }
    setup()
    window.addEventListener('resize', setup)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer?.disconnect()
      boundaryObserver?.disconnect()
      window.removeEventListener('resize', setup)
      window.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
      targets.forEach((target, index) => {
        target.style.scrollMarginTop = previousMargins[index]
      })
    }
  }, [items, variant, revealAfter])

  useEffect(() => {
    const track = ref.current
    if (!track) return
    const reveal = () => {
      const link = track.querySelector<HTMLAnchorElement>('a[aria-current="location"]')
      if (!link) return
      const trackBounds = track.getBoundingClientRect()
      const linkBounds = link.getBoundingClientRect()
      const arrows = navigation.current?.querySelectorAll<HTMLButtonElement>('button')
      const start = trackBounds.left + (arrows?.[0]?.offsetWidth || 0)
      const end = trackBounds.right - (arrows?.[1]?.offsetWidth || 0)
      if (linkBounds.left < start || linkBounds.right > end) {
        track.scrollBy({
          left: linkBounds.left < start ? linkBounds.left - start : linkBounds.right - end,
          behavior: scrollBehavior(),
        })
      }
    }
    reveal()
    window.addEventListener('resize', reveal)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal)
    observer?.observe(track)
    Array.from(track.children).forEach((link) => observer?.observe(link))
    return () => {
      window.removeEventListener('resize', reveal)
      observer?.disconnect()
    }
  }, [active, ref])

  if (!items.length) return null

  return (
    <nav
      ref={navigation}
      className={styles.navigation}
      aria-label={variant === 'category' ? 'Product categories' : 'Product sections'}
      data-variant={variant}
      data-stuck={stuck || undefined}
      data-reveal-after={revealAfter}
      aria-hidden={Boolean(revealAfter && !stuck) || undefined}
      inert={Boolean(revealAfter && !stuck)}
    >
      <div className={styles.container}>
        <div className={styles.overflow}>
          <div className={styles.links} ref={ref}>
            {items.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={active === id ? 'location' : undefined}
                className={styles.link}
                onClick={(event) => {
                  const target = document.getElementById(id)
                  if (!target) return
                  event.preventDefault()
                  setActive(id)
                  if (variant === 'detail' && id === 'overview') setStuck(false)
                  target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
                  window.history.replaceState(
                    window.history.state,
                    '',
                    `#${encodeURIComponent(id)}`,
                  )
                }}
              >
                {label}
              </a>
            ))}
          </div>
          <button
            className={`${styles.arrow} ${styles.previous}`}
            type="button"
            aria-label="Previous sections"
            hidden={!edges.previous}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft strokeWidth={1.5} aria-hidden="true" size={18} />
          </button>
          <button
            className={`${styles.arrow} ${styles.next}`}
            type="button"
            aria-label="Next sections"
            hidden={!edges.next}
            onClick={() => scroll(1)}
          >
            <ChevronRight strokeWidth={1.5} aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
    </nav>
  )
}
