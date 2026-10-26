'use client'
import React from 'react'
import { Media } from '@/components/Media'
import { useProductSelection } from '../ProductSelection'
import styles from './index.module.css'

export function ProductOptions() {
  const { product, selection, selectValue } = useProductSelection()
  if (!product.options.length) return null
  return (
    <div className={styles.root}>
      {product.options.map((group) => {
        const selected =
          group.values.find((value) => value.key === selection[group.key]) ?? group.values[0]
        return (
          <div key={group.key} className={styles.group}>
            <p id={`option-${group.key}`} className={styles.label}>
              {group.name}: <span>{selected?.label}</span>
            </p>
            <div
              role="radiogroup"
              aria-labelledby={`option-${group.key}`}
              className={styles.values}
            >
              {group.values.map((value, index) => (
                <button
                  key={value.key}
                  type="button"
                  role="radio"
                  aria-label={value.label}
                  aria-checked={selected?.key === value.key}
                  tabIndex={selected?.key === value.key ? 0 : -1}
                  className={styles[group.display]}
                  onClick={() => selectValue(group.key, value.key)}
                  onKeyDown={(event) => {
                    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key)
                      ? 1
                      : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                        ? -1
                        : 0
                    if (!direction && !['Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const next =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? group.values.length - 1
                          : (index + direction + group.values.length) % group.values.length
                    selectValue(group.key, group.values[next].key)
                    ;(
                      event.currentTarget.parentElement?.querySelectorAll('button')[
                        next
                      ] as HTMLElement
                    )?.focus()
                  }}
                >
                  {group.display === 'swatch' ? (
                    <span style={{ backgroundColor: value.swatch ?? undefined }} />
                  ) : group.display === 'image' && value.image ? (
                    <Media
                      resource={value.image}
                      fill
                      size="56px"
                      imgClassName={styles.image}
                      presentation={{ image: { fit: 'contain' } }}
                    />
                  ) : (
                    value.label
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
