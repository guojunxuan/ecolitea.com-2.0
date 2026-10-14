'use client'

import Link from 'next/link'
import React, { useEffect, useId, useRef } from 'react'

import type { CategoryLink } from './CategoryLinks'
import styles from './index.module.css'
import { rememberNavigationOffset, useRestoreNavigationOffset } from './keepNavigationInPlace'

export function MobileCategoryMenu({
  links,
  currentCategory,
}: {
  links: CategoryLink[]
  currentCategory?: string
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const panelID = useId()
  useRestoreNavigationOffset(detailsRef, currentCategory)
  const currentSlug = currentCategory || null
  const currentTitle = links.find(({ slug }) => slug === currentSlug)?.title ?? links[0]?.title

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = detailsRef.current
      if (details?.open && event.target instanceof Node && !details.contains(event.target))
        details.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  useEffect(() => {
    if (detailsRef.current) detailsRef.current.open = false
  }, [currentCategory])

  return (
    <details
      className={styles.mobileMenu}
      data-slot="blog-mobile-menu"
      ref={detailsRef}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !detailsRef.current?.open) return
        event.preventDefault()
        detailsRef.current.open = false
        summaryRef.current?.focus()
      }}
    >
      <summary className={styles.mobileTrigger} ref={summaryRef} aria-controls={panelID}>
        {currentTitle}
        <svg
          className={styles.chevron}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="m4 7 6 6 6-6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </summary>
      <div className={styles.mobilePanel} id={panelID}>
        {links.map((category) => (
          <Link
            aria-current={category.slug === currentSlug ? 'page' : undefined}
            className={styles.mobileLink}
            href={category.slug ? `/blogs/category/${category.slug}` : '/blogs'}
            key={category.id}
            scroll={false}
            onClick={(event) => {
              rememberNavigationOffset(event)
              if (detailsRef.current) detailsRef.current.open = false
            }}
          >
            {category.title}
          </Link>
        ))}
      </div>
    </details>
  )
}
