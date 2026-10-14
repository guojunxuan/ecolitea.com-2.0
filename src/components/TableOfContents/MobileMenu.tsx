'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TOCItem } from '@/utilities/blogs/extractTOC'
import { TocList } from './TocList'
import styles from './index.module.css'

/** Mobile disclosure under the sticky bar; it closes like the Blog category dropdown. */
export const MobileMenu = ({ items, activeId }: { items: TOCItem[]; activeId?: string }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const desktop = window.matchMedia('(min-width: 64rem)')
    const onDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener('change', onDesktop)
    return () => desktop.removeEventListener('change', onDesktop)
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const activeLink = panel?.querySelector<HTMLAnchorElement>('a[aria-current="location"]')
    const indicator = panel?.querySelector<HTMLElement>('[data-toc-indicator]')
    if (!panel || !activeLink || !indicator) return
    panel.scrollTop = Math.max(0, activeLink.offsetTop - panel.clientHeight * 0.25)
    indicator.style.transition = 'none'
    indicator.style.transform = `translateY(${panel.scrollTop}px)`
    indicator.style.height = `${activeLink.offsetHeight}px`
    void indicator.offsetHeight
    const frame = requestAnimationFrame(() => {
      indicator.style.transition = ''
      indicator.style.transform = `translateY(${activeLink.offsetTop}px)`
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  return (
    <div
      className={styles.mobile}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }}
    >
      <div className={styles.mobileBar}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.mobileTrigger}
          aria-label="Table of contents"
          aria-controls={panelId}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.mobileLabel}>On this page</span>
          <span className={styles.current}>
            {items.find((item) => item.id === activeId)?.text ?? items[0]?.text}
          </span>
          <ChevronDown aria-hidden="true" size={16} />
        </button>
      </div>
      <nav
        aria-label="Table of contents"
        className={styles.mobilePanel}
        hidden={!open}
        id={panelId}
        ref={panelRef}
      >
        <TocList
          key={open ? 'open' : 'closed'}
          items={items}
          activeId={activeId}
          mobile
          visible={open}
          onSelect={() => setOpen(false)}
        />
      </nav>
      {open && (
        <button
          aria-label="Close table of contents"
          className={styles.mobileScrim}
          onClick={() => setOpen(false)}
          tabIndex={-1}
          type="button"
        />
      )}
    </div>
  )
}
