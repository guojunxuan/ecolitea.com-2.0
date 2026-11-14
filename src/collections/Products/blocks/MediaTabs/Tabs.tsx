'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import type { ProductMediaTabsBlock } from '@/payload-types'
import { ActiveMedia } from '../shared/ActiveMedia'
import { MediaArrow } from '../shared/MediaArrow'
import styles from './Component.module.css'

export function Tabs({
  tabs,
  aspectRatio,
  label,
}: {
  tabs: NonNullable<ProductMediaTabsBlock['tabs']>
  aspectRatio: string
  label: string
}) {
  const [selectedIndex, setActive] = useState(0)
  const active = Math.max(0, Math.min(selectedIndex, tabs.length - 1))
  const [visited, setVisited] = useState(() => new Set([0]))
  const [line, setLine] = useState<{ left: number; width: number } | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    const update = () => {
      const button = list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[active]
      if (button) setLine({ left: button.offsetLeft, width: button.offsetWidth })
    }
    update()
    if (!list.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(list.current)
    return () => observer.disconnect()
  }, [active])
  const select = (index: number, focus = false) => {
    const next = (index + tabs.length) % tabs.length
    setVisited((previous) => new Set(previous).add(next))
    setActive(next)
    const button = list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
    if (focus) button?.focus()
    button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }
  const hasDescriptions = tabs.some((tab) => Boolean(tab.description?.trim()))
  return (
    <div>
      <div className={styles.mediaArea}>
        <div className={styles.panels}>
          {tabs.map((tab, index) => (
            <div
              key={tab.id || index}
              id={`${id}-panel-${index}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${index}`}
              aria-hidden={index !== active}
              inert={index !== active}
              tabIndex={index === active ? 0 : -1}
              className={styles.panel}
              data-active={index === active}
            >
              {(index === active || visited.has(index)) && (
                <ActiveMedia
                  resource={tab.media}
                  className={styles.media}
                  playback={tab.playback}
                  aspectRatio={aspectRatio}
                  mobileAspectRatio={aspectRatio === '21:9' ? '16:9' : undefined}
                  active={index === active}
                />
              )}
            </div>
          ))}
        </div>
        {tabs.length > 1 && (
          <div className={styles.arrows}>
            <MediaArrow
              direction="previous"
              overlay
              aria-label="Previous tab"
              onClick={() => select(active - 1)}
            />
            <MediaArrow
              direction="next"
              overlay
              aria-label="Next tab"
              onClick={() => select(active + 1)}
            />
          </div>
        )}
      </div>
      <div className={styles.navigation}>
        <div
          className={styles.tablist}
          ref={list}
          role="tablist"
          aria-label={label}
          data-measured={Boolean(line)}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id || index}
              type="button"
              role="tab"
              className="website-type-button"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              onClick={() => select(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? active + 1
                    : event.key === 'ArrowLeft'
                      ? active - 1
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : null
                if (next === null) return
                event.preventDefault()
                select(next, true)
              }}
            >
              {tab.title}
            </button>
          ))}
          {line && (
            <span
              aria-hidden="true"
              className={styles.line}
              style={{ width: line.width, transform: `translateX(${line.left}px)` }}
            />
          )}
        </div>
      </div>
      {hasDescriptions && (
        <div className={styles.descriptions} data-tab-description>
          {tabs.map((tab, index) => (
            <p
              key={tab.id || index}
              className="website-type-body-md"
              data-active={index === active}
              aria-hidden={index !== active}
            >
              {tab.description || '\u00a0'}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
