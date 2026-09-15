'use client'

import { ChevronDown, ChevronLeft, ChevronRight, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { DesktopMegaMenu } from './DesktopMegaMenu'
import { NavigationLink } from './NavigationLink'
import type { HeaderNavigationData, HeaderNavigationItem } from './types'
import styles from './index.module.css'

const Trigger: React.FC<{
  item: HeaderNavigationItem
  menuID: string
  onEnter: () => void
  onToggle: () => void
  open: boolean
  setRef: (node: HTMLElement | null) => void
}> = ({ item, menuID, onEnter, onToggle, open, setRef }) => {
  if (item.navigationType === 'directLink') return <NavigationLink className={styles.topLevelLink} link={item.link} />
  if (item.navigationType === 'directLinkAndDropdown') {
    return <span className={styles.hybridControl} onPointerEnter={onEnter}>
      <NavigationLink className={styles.topLevelLink} link={item.link} />
      <button aria-controls={menuID} aria-expanded={open} aria-label={`${item.label} menu`} className={styles.disclosureButton} onClick={onToggle} onPointerEnter={onEnter} ref={setRef} type="button"><ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} /></button>
    </span>
  }
  return <button aria-controls={menuID} aria-expanded={open} aria-label={`${item.label} menu`} className={styles.dropdownButton} onClick={onToggle} onPointerEnter={onEnter} ref={setRef} type="button">
    <span>{item.label}</span><ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
  </button>
}

const isOverflowing = (element: HTMLElement) => element.scrollWidth > element.clientWidth + 1

export const DesktopNav: React.FC<HeaderNavigationData> = ({ menuCta, navItems }) => {
  const pathname = usePathname()
  const idPrefix = useId().replaceAll(':', '')
  const rootRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const itemRootRefs = useRef<Record<string, HTMLElement | null>>({})
  const clickedClosedRef = useRef<string | null>(null)
  const suppressHoverRef = useRef(false)
  const [openID, setOpenID] = useState<string | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const updateOverflow = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    setOverflow(isOverflowing(strip))
    setAtStart(strip.scrollLeft <= 1)
    setAtEnd(strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1)
  }, [])

  const close = useCallback(() => {
    setOpenID(null)
    clickedClosedRef.current = null
  }, [])

  const enter = useCallback((id: string) => {
    if (suppressHoverRef.current || clickedClosedRef.current === id) return
    setOpenID(id)
  }, [])

  const toggle = useCallback((id: string) => {
    setOpenID((current) => {
      if (current === id) {
        clickedClosedRef.current = id
        return null
      }
      clickedClosedRef.current = null
      return id
    })
  }, [])

  const ensureVisible = useCallback((id: string) => {
    itemRootRefs.current[id]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (openID && !navItems.some((item) => item.id === openID)) {
      // Content updates can remove the active owner while the menu is open.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      close()
    }
  }, [close, navItems, openID])

  useLayoutEffect(() => {
    updateOverflow()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateOverflow)
    if (stripRef.current) observer.observe(stripRef.current)
    if (trackRef.current) observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [navItems, updateOverflow])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onScroll = () => {
      suppressHoverRef.current = true
      updateOverflow()
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => strip.removeEventListener('scroll', onScroll)
  }, [updateOverflow])

  // Route changes are an external dismissal event for this client-owned menu state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { close() }, [close, pathname])

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 73.1875rem)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => { if (!event.matches) close() }
    onChange(media)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [close])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !openID) return
      const owner = itemRefs.current[openID]
      close()
      owner?.focus()
      owner?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [close, openID])

  const scrollToBoundary = (direction: 'left' | 'right') => {
    const strip = stripRef.current
    const track = trackRef.current
    if (!strip || !track) return
    const entries = Array.from(track.children) as HTMLElement[]
    const current = strip.scrollLeft
    const visible = strip.clientWidth
    let target = direction === 'right' ? strip.scrollWidth : 0
    if (direction === 'right') {
      const next = entries.find((entry) => entry.offsetLeft > current + 2)
      target = next ? Math.min(next.offsetLeft, current + visible * 0.75) : strip.scrollWidth
    } else {
      const previous = entries.filter((entry) => entry.offsetLeft < current - 2).at(-1)
      target = previous ? Math.max(previous.offsetLeft, current - visible * 0.75) : 0
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    suppressHoverRef.current = true
    strip.scrollTo({ left: target, behavior: reduced ? 'auto' : 'smooth' })
  }

  const activeItem = navItems.find((item) => item.id === openID)
  const activeMenuID = activeItem ? `${idPrefix}-${activeItem.id}-menu` : undefined

  return <div className={styles.desktopNav} data-desktop-nav-root="true" onPointerLeave={(event) => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    close()
  }} ref={rootRef}>
    <div className={styles.primaryNavigationFrame}>
      {overflow && <button aria-label="Scroll navigation left" className={styles.scrollButton} disabled={atStart} onClick={() => scrollToBoundary('left')} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>}
      <nav aria-label="Primary" className={styles.primaryNavigation} data-overflow={overflow} ref={stripRef}>
        <div className={styles.primaryNavigationTrack} ref={trackRef}>
          {navItems.map((item) => {
            const menuID = `${idPrefix}-${item.id}-menu`
            return <span className={styles.primaryNavigationItem} data-nav-item-id={item.id} key={item.id} onFocus={() => ensureVisible(item.id)} onPointerEnter={() => {
              if (item.navigationType === 'directLink') close()
              else enter(item.id)
            }} onPointerMove={() => {
              if (suppressHoverRef.current) suppressHoverRef.current = false
              if (item.navigationType !== 'directLink') enter(item.id)
            }} ref={(node) => { itemRootRefs.current[item.id] = node }}>
              <Trigger item={item} menuID={menuID} onEnter={() => enter(item.id)} onToggle={() => toggle(item.id)} open={openID === item.id} setRef={(node) => { itemRefs.current[item.id] = node }} />
            </span>
          })}
        </div>
      </nav>
      {overflow && <button aria-label="Scroll navigation right" className={styles.scrollButton} disabled={atEnd} onClick={() => scrollToBoundary('right')} type="button"><ChevronRight aria-hidden="true" size={18} /></button>}
    </div>
    <div className={styles.actions}>
      <Link aria-label="Search" className={styles.searchLink} href="/search"><SearchIcon aria-hidden="true" size={19} strokeWidth={1.75} /></Link>
      {menuCta && <NavigationLink className={styles.menuCta} link={menuCta} />}
    </div>
    {activeItem && activeItem.content.length > 0 && activeMenuID && <DesktopMegaMenu blocks={activeItem.content} id={activeMenuID} label={activeItem.label} />}
  </div>
}
