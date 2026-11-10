'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type PointerEvent, type ReactNode } from 'react'

import { useOverflowTrack } from './useOverflowTrack'
import styles from './index.module.css'

export const OverflowTrack = ({
  title,
  children,
  variant = 'default',
  className,
  trackClassName,
  draggable = false,
  controls = 'default',
}: {
  title: string
  children: ReactNode
  variant?: 'default' | 'contained'
  className?: string
  trackClassName?: string
  draggable?: boolean
  controls?: 'default' | 'outer'
}) => {
  const { ref, edges, scroll } = useOverflowTrack(0.8)
  const drag = useRef<{ id: number; startX: number; scrollLeft: number; active: boolean } | null>(
    null,
  )
  const suppressClick = useRef(false)
  const overflowing = edges.previous || edges.next
  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    event.currentTarget.removeAttribute('data-dragging')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className={`${styles.viewport} ${variant === 'contained' ? styles.contained : ''} ${controls === 'outer' ? styles.outerControls : ''} ${className ?? ''}`}
      data-overflow-controls={controls}
      data-draggable={draggable && overflowing ? true : undefined}
      data-overflow-start={edges.previous || undefined}
      data-overflow-end={edges.next || undefined}
    >
      <div
        ref={ref}
        className={`${styles.track} ${trackClassName ?? ''}`}
        role="region"
        aria-label={title}
        aria-roledescription={draggable && !overflowing ? undefined : 'carousel'}
        tabIndex={draggable && !overflowing ? -1 : 0}
        onPointerDown={(event) => {
          suppressClick.current = false
          if (!draggable || !overflowing || event.pointerType !== 'mouse' || event.button !== 0)
            return
          drag.current = {
            id: event.pointerId,
            startX: event.clientX,
            scrollLeft: event.currentTarget.scrollLeft,
            active: false,
          }
        }}
        onPointerMove={(event) => {
          const gesture = drag.current
          if (!gesture || gesture.id !== event.pointerId) return
          if (event.buttons !== 1) {
            finishDrag(event)
            return
          }
          const distance = event.clientX - gesture.startX
          if (!gesture.active && Math.abs(distance) <= 6) return
          if (!gesture.active) {
            gesture.active = true
            suppressClick.current = true
            event.currentTarget.setAttribute('data-dragging', '')
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          event.preventDefault()
          event.currentTarget.scrollLeft = gesture.scrollLeft - distance
        }}
        onPointerUp={finishDrag}
        onPointerCancel={(event) => {
          finishDrag(event)
          suppressClick.current = false
        }}
        onLostPointerCapture={finishDrag}
        onPointerLeave={() => {
          if (!drag.current?.active) drag.current = null
        }}
        onDragStart={(event) => {
          if (draggable && overflowing) event.preventDefault()
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }}
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
        hidden={!overflowing}
        disabled={!edges.previous}
        onClick={() => scroll(-1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        className={`${styles.arrow} ${styles.next}`}
        aria-label="Next items"
        hidden={!overflowing}
        disabled={!edges.next}
        onClick={() => scroll(1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}
