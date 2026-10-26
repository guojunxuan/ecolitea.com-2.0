'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { useOverflowTrack } from './useOverflowTrack'
import styles from './index.module.css'

export const OverflowTrack = ({ title, children }: { title: string; children: ReactNode }) => {
  const { ref, edges, scroll } = useOverflowTrack(0.8)

  return (
    <div className={styles.viewport}>
      <div
        ref={ref}
        className={styles.track}
        role="region"
        aria-label={title}
        aria-roledescription="carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
          )
            return
          event.preventDefault()
          scroll(event.key === 'ArrowLeft' ? -1 : 1)
        }}
      >
        {children}
      </div>
      <button
        className={`${styles.arrow} ${styles.previous}`}
        aria-label="Previous items"
        hidden={!edges.previous}
        onClick={() => scroll(-1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        className={`${styles.arrow} ${styles.next}`}
        aria-label="Next items"
        hidden={!edges.next}
        onClick={() => scroll(1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}
