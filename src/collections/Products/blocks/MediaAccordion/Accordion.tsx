'use client'

import React, { useId, useRef, useState } from 'react'
import type { ProductMediaAccordionBlock } from '@/payload-types'
import { ActiveMedia } from '../shared/ActiveMedia'
import { useMediaQuery } from '../shared/useMediaQuery'
import styles from './Component.module.css'
import splitStyles from '../shared/SplitMedia.module.css'

type Item = Omit<NonNullable<ProductMediaAccordionBlock['items']>[number], 'body'> & {
  body: React.ReactNode
}
type Props = Pick<ProductMediaAccordionBlock, 'aspectRatio' | 'mediaPosition'> & { items: Item[] }

export function Accordion({ items, aspectRatio, mediaPosition }: Props) {
  const [selectedIndex, setActive] = useState(0)
  const active = Math.max(0, Math.min(selectedIndex, items.length - 1))
  const mobile = useMediaQuery('(width < 48rem)')
  const id = useId()
  const triggers = useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div className={styles.layout} data-position={mediaPosition}>
      <div className={styles.copy}>
        {items.map((item, index) => (
          <div key={item.id || index} className={styles.item} data-open={active === index}>
            <h4 className="website-type-title">
              <button
                ref={(element) => {
                  triggers.current[index] = element
                }}
                type="button"
                id={`${id}-trigger-${index}`}
                aria-expanded={active === index}
                aria-controls={`${id}-body-${index}`}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowDown'
                      ? (index + 1) % items.length
                      : event.key === 'ArrowUp'
                        ? (index - 1 + items.length) % items.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? items.length - 1
                            : null
                  if (next === null) return
                  event.preventDefault()
                  triggers.current[next]?.focus()
                }}
              >
                {item.title}
                <span aria-hidden="true" className={styles.icon} />
              </button>
            </h4>
            <div
              className={styles.body}
              data-open={active === index}
              id={`${id}-body-${index}`}
              role="region"
              aria-labelledby={`${id}-trigger-${index}`}
              aria-hidden={active !== index}
              inert={active !== index}
            >
              <div>
                {item.body}
                {mobile && active === index && (
                  <div className={styles.inlineMedia}>
                    <ActiveMedia
                      className={splitStyles.frame}
                      active
                      resource={item.media}
                      playback={item.playback}
                      aspectRatio={aspectRatio}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!mobile && (
        <div className={styles.visual}>
          {items.map((item, index) => (
            <div
              key={item.id || index}
              className={styles.panel}
              data-active={active === index}
              aria-hidden={active !== index}
              inert={active !== index}
            >
              <ActiveMedia
                className={splitStyles.frame}
                active={active === index}
                resource={item.media}
                playback={item.playback}
                aspectRatio={aspectRatio}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
