'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CMSLink } from '@/components/Link'
import {
  scrollBehavior,
  useOverflowTrack,
} from '@/components/Products/OverflowCarousel/useOverflowTrack'
import type { InquiryButton } from '@/utilities/products/models'

import styles from './index.module.css'

type AnchorItem = { id: string; label: string }

export const AnchorNav = ({
  items,
  variant,
  action,
}: {
  items: AnchorItem[]
  variant: 'category' | 'detail'
  action?: InquiryButton
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
    targets.forEach((target) => {
      target.style.scrollMarginTop =
        'calc(var(--header-height) + var(--website-anchor-nav-height) + var(--website-space-4))'
    })
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
    let overviewObserver: IntersectionObserver | undefined
    const setup = () => {
      observer?.disconnect()
      overviewObserver?.disconnect()
      if (!navigation.current) return
      const measured = getComputedStyle(navigation.current)
      const header = Number.parseFloat(measured.top) || 0
      const navHeight = Number.parseFloat(measured.height) || 0
      const space = Number.parseFloat(measured.getPropertyValue('--website-space-4')) || 0
      if (typeof IntersectionObserver === 'undefined') return
      spy = () => {
        const offset = header + navHeight + space
        const passed = targets.filter((target) => target.getBoundingClientRect().top <= offset + 1)
        const current =
          passed.at(-1) ??
          targets.find((target) => target.getBoundingClientRect().top < window.innerHeight * 0.5)
        if (current) setActive(current.id)
      }
      observer = new IntersectionObserver(spy, {
        rootMargin: `-${header + navHeight}px 0px -55% 0px`,
        threshold: 0,
      })
      targets.forEach((target) => observer?.observe(target))
      if (variant === 'detail') {
        const overview = document.getElementById('overview')
        if (overview) {
          setStuck(overview.getBoundingClientRect().bottom <= header)
          overviewObserver = new IntersectionObserver(
            ([entry]) => {
              if (entry)
                setStuck(!entry.isIntersecting && entry.boundingClientRect.bottom <= header)
            },
            { rootMargin: `-${header}px 0px 0px 0px`, threshold: 0 },
          )
          overviewObserver.observe(overview)
        }
      }
    }
    setup()
    window.addEventListener('resize', setup)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer?.disconnect()
      overviewObserver?.disconnect()
      window.removeEventListener('resize', setup)
      window.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
      targets.forEach((target, index) => {
        target.style.scrollMarginTop = previousMargins[index]
      })
    }
  }, [items, variant])

  useEffect(() => {
    const track = ref.current
    const link = track?.querySelector<HTMLAnchorElement>('a[aria-current="location"]')
    if (!track || !link) return
    const trackBounds = track.getBoundingClientRect()
    const linkBounds = link.getBoundingClientRect()
    if (linkBounds.left < trackBounds.left || linkBounds.right > trackBounds.right) {
      link.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: scrollBehavior() })
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
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button
            className={`${styles.arrow} ${styles.next}`}
            type="button"
            aria-label="Next sections"
            hidden={!edges.next}
            onClick={() => scroll(1)}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
        {variant === 'detail' && stuck && action && (
          <div className={styles.action}>
            <CMSLink {...action} appearance={action.appearance ?? 'default'} size="sm" />
          </div>
        )}
      </div>
    </nav>
  )
}
