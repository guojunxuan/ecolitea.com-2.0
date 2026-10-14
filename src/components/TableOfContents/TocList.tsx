'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TOCItem } from '@/utilities/blogs/extractTOC'
import styles from './index.module.css'

export const TocList = ({
  items,
  activeId,
  mobile = false,
  visible = true,
  onSelect,
}: {
  items: TOCItem[]
  activeId?: string
  mobile?: boolean
  visible?: boolean
  onSelect?: () => void
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const pointRef = useRef<{ x: number; y: number } | null>(null)
  const pressedRef = useRef(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!visible || !track?.getClientRects().length) return
    const link = Array.from(track.querySelectorAll<HTMLAnchorElement>('a')).find(
      (entry) => entry.dataset.tocId === (previewId ?? activeId),
    )
    const indicator = track.querySelector<HTMLElement>('[data-toc-indicator]')
    if (!link || !indicator) return
    indicator.style.transform = `translateY(${link.offsetTop}px)`
    indicator.style.height = `${link.offsetHeight}px`
  }, [activeId, previewId, visible])

  useEffect(() => {
    if (!mobile || !visible) return
    const panel = trackRef.current?.closest('nav')
    if (!panel) return
    const onScroll = () => {
      if (pressedRef.current) {
        pressedRef.current = false
        setPressedId(null)
        setPreviewId(null)
        return
      }
      const point = pointRef.current
      if (!point) return
      const target = document.elementFromPoint(point.x, point.y)?.closest<HTMLAnchorElement>('a')
      setPreviewId(target && panel.contains(target) ? (target.dataset.tocId ?? null) : null)
    }
    panel.addEventListener('scroll', onScroll, { passive: true })
    return () => panel.removeEventListener('scroll', onScroll)
  }, [mobile, visible])

  return (
    <div
      className={styles.tocTrack}
      data-toc-track
      ref={trackRef}
      onPointerMove={
        mobile
          ? (event) => {
              pointRef.current = { x: event.clientX, y: event.clientY }
              if (pressedRef.current) return
              const link = (event.target as Element).closest<HTMLAnchorElement>('a')
              setPreviewId(link?.dataset.tocId ?? null)
            }
          : undefined
      }
      onPointerLeave={() => {
        pointRef.current = null
        pressedRef.current = false
        setPressedId(null)
        setPreviewId(null)
      }}
      onPointerCancel={() => {
        pressedRef.current = false
        setPressedId(null)
        setPreviewId(null)
      }}
    >
      <span aria-hidden="true" className={styles.tocIndicator} data-toc-indicator />
      <ol className={mobile ? styles.mobileList : styles.desktopList}>
        {items.map((item) => (
          <li className={item.level === 3 ? styles.nested : styles.primary} key={item.id}>
            <a
              href={`#${item.id}`}
              data-toc-id={item.id}
              data-pressed={pressedId === item.id ? 'true' : undefined}
              aria-current={item.id === activeId ? 'location' : undefined}
              onPointerEnter={() => setPreviewId(item.id)}
              onFocus={() => setPreviewId(item.id)}
              onBlur={() => setPreviewId(null)}
              onPointerDown={
                mobile
                  ? () => {
                      pressedRef.current = true
                      setPressedId(item.id)
                      setPreviewId(item.id)
                    }
                  : undefined
              }
              onClick={() => {
                pressedRef.current = false
                setPressedId(null)
                onSelect?.()
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </div>
  )
}
