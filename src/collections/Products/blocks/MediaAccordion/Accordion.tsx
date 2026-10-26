'use client'

import React, { useId, useRef, useState } from 'react'
import type { ProductMediaAccordionBlock } from '@/payload-types'
import { ActiveMedia } from '../shared/ActiveMedia'
import styles from './Component.module.css'

type Item = Omit<NonNullable<ProductMediaAccordionBlock['items']>[number], 'body'> & {
  body: React.ReactNode
}
type Props = Pick<ProductMediaAccordionBlock, 'defaultMedia' | 'aspectRatio' | 'mediaPosition'> & {
  items: Item[]
  header: React.ReactNode
}

export function Accordion({ items, defaultMedia, aspectRatio, mediaPosition, header }: Props) {
  const [active, setActive] = useState<number | null>(0)
  const id = useId()
  const copy = useRef<HTMLDivElement>(null)
  return (
    <div className={styles.layout} data-position={mediaPosition}>
      <div className={styles.copy} ref={copy}>
        {header}
        {items.map((item, index) => (
          <div key={item.id || index} className={styles.item}>
            <h3>
              <button
                type="button"
                id={`${id}-trigger-${index}`}
                aria-expanded={active === index}
                aria-controls={`${id}-body-${index}`}
                onClick={() => setActive(active === index ? null : index)}
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
                  copy.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
                }}
              >
                {item.title}
                <span aria-hidden="true" className={styles.icon}>
                  +
                </span>
              </button>
            </h3>
            <div
              className={styles.body}
              data-open={active === index}
              id={`${id}-body-${index}`}
              role="region"
              aria-labelledby={`${id}-trigger-${index}`}
              aria-hidden={active !== index}
              inert={active !== index}
            >
              <div>{item.body}</div>
            </div>
          </div>
        ))}
      </div>
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
              active={active === index}
              resource={typeof item.media === 'object' && item.media ? item.media : defaultMedia}
              playback={item.playback}
              aspectRatio={aspectRatio}
            />
          </div>
        ))}
        <div
          className={styles.panel}
          data-active={active === null}
          aria-hidden={active !== null}
          inert={active !== null}
        >
          <ActiveMedia
            active={active === null}
            resource={defaultMedia}
            playback="ambient"
            aspectRatio={aspectRatio}
          />
        </div>
      </div>
    </div>
  )
}
