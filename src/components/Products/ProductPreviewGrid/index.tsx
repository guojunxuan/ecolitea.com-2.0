'use client'
import React, { useRef, useState } from 'react'
import { SegmentIndicator } from '../SegmentIndicator'
import styles from './index.module.css'
export function ProductPreviewGrid({
  children,
  count,
}: {
  children: React.ReactNode
  count: number
}) {
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  return (
    <>
      <div
        ref={track}
        className={styles.grid}
        onScroll={(event) => {
          const element = event.currentTarget
          const child = element.firstElementChild as HTMLElement | null
          if (child) {
            const gap = parseFloat(getComputedStyle(element).columnGap) || 0
            setActive(
              Math.max(
                0,
                Math.min(count - 1, Math.round(element.scrollLeft / (child.offsetWidth + gap))),
              ),
            )
          }
        }}
      >
        {children}
      </div>
      <div className={styles.segments}>
        <SegmentIndicator count={count} active={active} />
      </div>
    </>
  )
}
