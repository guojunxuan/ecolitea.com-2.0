'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import type { ProductMediaTabsBlock } from '@/payload-types'
import { ActiveMedia } from '../shared/ActiveMedia'
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
  const [active, setActive] = useState(0)
  const [line, setLine] = useState({ left: 0, width: 0 })
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
    const next = Math.max(0, Math.min(tabs.length - 1, index))
    setActive(next)
    const button = list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]
    if (focus) button?.focus()
    button?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
  }
  return (
    <div>
      <div className={styles.navigation}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Previous tab"
          disabled={active === 0}
          onClick={() => select(active - 1)}
        >
          ←
        </button>
        <div className={styles.tablist} ref={list} role="tablist" aria-label={label}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id || index}
              type="button"
              role="tab"
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
          <span
            aria-hidden="true"
            className={styles.line}
            style={{ width: line.width, transform: `translateX(${line.left}px)` }}
          />
        </div>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Next tab"
          disabled={active === tabs.length - 1}
          onClick={() => select(active + 1)}
        >
          →
        </button>
      </div>
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
            <ActiveMedia
              resource={tab.media}
              playback={tab.playback}
              aspectRatio={aspectRatio}
              active={index === active}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
