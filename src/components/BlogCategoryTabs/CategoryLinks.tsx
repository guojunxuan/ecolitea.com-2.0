'use client'

import Link from 'next/link'
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'

import styles from './index.module.css'

export type CategoryLink = { id: string; title: string; slug: string | null }

export function CategoryLinks({
  links,
  currentCategory,
}: {
  links: CategoryLink[]
  currentCategory?: string
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const focusedRef = useRef<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const ownerRef = useRef<string | null>(null)
  const [indicator, setIndicator] = useState({
    x: 0,
    y: 0,
    width: 0,
    visible: false,
    moving: false,
  })
  const activeID = links.find((link) => link.slug === (currentCategory || null))?.id ?? 'all'
  const linksKey = links.map(({ id, title }) => `${id}:${title}`).join('|')

  const moveIndicator = useCallback(
    (id: string | null) => {
      ownerRef.current = id
      const row = rowRef.current
      const link = id ? linkRefs.current[id] : null
      if (!row || !link || id === activeID) {
        setIndicator((previous) => (previous.visible ? { ...previous, visible: false } : previous))
        return
      }
      const bounds = row.getBoundingClientRect()
      const item = link.getBoundingClientRect()
      const next = {
        x: item.left - bounds.left,
        y: item.bottom - bounds.top - 2,
        width: item.width,
      }
      setIndicator((previous) =>
        previous.visible &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width
          ? previous
          : { ...next, visible: item.width > 0, moving: previous.visible },
      )
    },
    [activeID],
  )

  useLayoutEffect(() => {
    focusedRef.current = null
    hoveredRef.current = null
    moveIndicator(null)
    const measure = () => moveIndicator(ownerRef.current)
    const row = rowRef.current
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (row) observer?.observe(row)
    for (const link of Object.values(linkRefs.current)) if (link) observer?.observe(link)
    window.addEventListener('resize', measure)
    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) measure()
    })
    return () => {
      cancelled = true
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [linksKey, moveIndicator])

  return (
    <div
      className={styles.tabs}
      data-slot="blog-category-links"
      ref={rowRef}
      onPointerLeave={() => {
        hoveredRef.current = null
        moveIndicator(focusedRef.current)
      }}
    >
      {links.map((category) => (
        <Link
          aria-current={category.id === activeID ? 'page' : undefined}
          className={styles.tab}
          href={category.slug ? `/blogs/category/${category.slug}` : '/blogs'}
          key={category.id}
          ref={(node) => {
            linkRefs.current[category.id] = node
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === 'touch') return
            hoveredRef.current = category.id
            moveIndicator(category.id)
          }}
          onFocus={() => {
            focusedRef.current = category.id
            moveIndicator(category.id)
          }}
          onBlur={() => {
            focusedRef.current = null
            moveIndicator(hoveredRef.current)
          }}
        >
          {category.title}
        </Link>
      ))}
      <span
        aria-hidden="true"
        className={styles.indicator}
        data-category-indicator
        data-visible={indicator.visible ? 'true' : 'false'}
        data-moving={indicator.moving ? 'true' : 'false'}
        style={{
          transform: `translate(${indicator.x}px, ${indicator.y}px)`,
          width: indicator.width,
        }}
      />
    </div>
  )
}
