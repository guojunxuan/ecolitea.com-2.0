'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** Shared native overflow behavior for product rows and section navigation. */
export const useOverflowTrack = (step: number) => {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ previous: false, next: false })

  const update = useCallback(() => {
    const track = ref.current
    if (!track) return
    const overflowing = track.scrollWidth > track.clientWidth + 1
    const previous = overflowing && track.scrollLeft > 1
    const next = overflowing && track.scrollLeft + track.clientWidth < track.scrollWidth - 1
    setEdges((current) =>
      current.previous === previous && current.next === next ? current : { previous, next },
    )
  }, [])

  useEffect(() => {
    const track = ref.current
    if (!track) return
    update()
    track.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resize?.observe(track)
    Array.from(track.children).forEach((child) => resize?.observe(child))
    return () => {
      track.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      resize?.disconnect()
    }
  }, [update])

  const scroll = (direction: number) => {
    const track = ref.current
    track?.scrollBy({ left: direction * track.clientWidth * step, behavior: scrollBehavior() })
  }

  return { ref, edges, scroll, update }
}
