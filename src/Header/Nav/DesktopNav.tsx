'use client'

import { ChevronLeft, ChevronRight, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { DesktopMegaMenu } from './DesktopMegaMenu'
import { NavigationLink } from './NavigationLink'
import type { HeaderNavigationData } from './types'
import styles from './index.module.css'

const isOverflowing = (element: HTMLElement, availableWidth = element.clientWidth) =>
  element.scrollWidth > availableWidth + 1

type IndicatorState = { left: number; visible: boolean; width: number }
type DesktopNavProps = HeaderNavigationData & {
  compactFocusTargetRef?: React.RefObject<HTMLElement | null>
  onOpenChange?: (open: boolean) => void
  rootElementRef?: React.RefObject<HTMLDivElement | null>
}

export const DesktopNav: React.FC<DesktopNavProps> = ({
  compactFocusTargetRef,
  menuCta,
  navItems,
  onOpenChange,
  rootElementRef,
}) => {
  const pathname = usePathname()
  const idPrefix = useId().replaceAll(':', '')
  const internalRootRef = useRef<HTMLDivElement>(null)
  const rootRef = rootElementRef ?? internalRootRef
  const frameRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const triggerRefs = useRef<Record<string, HTMLElement | null>>({})
  const itemRefs = useRef<Record<string, HTMLElement | null>>({})
  const initializedOverflowKeyRef = useRef<string | null>(null)
  const pendingAlignmentScrollRef = useRef<number | null>(null)
  const userNavigationScrollRef = useRef(false)
  const ownsFocusRef = useRef(false)
  const indicatorOwnerRef = useRef<string | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressHoverRef = useRef(false)
  const pointerInsideRef = useRef(false)
  const [openID, setOpenID] = useState<string | null>(null)
  const [renderedID, setRenderedID] = useState<string | null>(null)
  const [menuPhase, setMenuPhase] = useState<'closing' | 'open'>('open')
  const [contentPhase, setContentPhase] = useState<'switching' | 'visible'>('visible')
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)
  const [indicator, setIndicator] = useState<IndicatorState>({ left: 0, visible: false, width: 0 })
  const navigationKey = navItems.map((item) => item.id).join('|')

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    openTimerRef.current = null
  }, [])
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])
  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = null
  }, [])
  const clearContentTimer = useCallback(() => {
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current)
    contentTimerRef.current = null
  }, [])

  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const updateIndicator = useCallback((id: string | null, visible = true) => {
    indicatorOwnerRef.current = id
    const viewport = viewportRef.current
    const item = id ? itemRefs.current[id] : null
    if (!viewport || !item || !visible) {
      setIndicator((current) => ({ ...current, visible: false }))
      return
    }
    const viewportRect = viewport.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    setIndicator({ left: itemRect.left - viewportRect.left, visible: true, width: itemRect.width })
  }, [])

  const close = useCallback(() => {
    clearOpenTimer()
    clearCloseTimer()
    clearExitTimer()
    clearContentTimer()
    setOpenID(null)
    setContentPhase('visible')
    if (reducedMotion()) {
      setRenderedID(null)
      setMenuPhase('open')
      return
    }
    setMenuPhase('closing')
    exitTimerRef.current = setTimeout(() => {
      setRenderedID(null)
      setMenuPhase('open')
    }, 180)
  }, [clearCloseTimer, clearContentTimer, clearExitTimer, clearOpenTimer])

  const scheduleClose = useCallback(() => {
    clearOpenTimer()
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      const focused = document.activeElement
      if (focused instanceof Node && rootRef.current?.contains(focused)) return
      setIndicator((current) => ({ ...current, visible: false }))
      close()
    }, 200)
  }, [clearCloseTimer, clearOpenTimer, close, rootRef])

  const open = useCallback(
    (id: string, delayed: boolean) => {
      clearCloseTimer()
      clearOpenTimer()
      clearExitTimer()
      updateIndicator(id)
      setMenuPhase('open')
      if (openID && openID !== id) {
        setOpenID(id)
        setRenderedID(id)
        setContentPhase('switching')
        clearContentTimer()
        if (reducedMotion()) setContentPhase('visible')
        else contentTimerRef.current = setTimeout(() => setContentPhase('visible'), 160)
      } else if (openID !== id) {
        const commitOpen = () => {
          setOpenID(id)
          setRenderedID(id)
          setContentPhase('visible')
        }
        if (delayed) openTimerRef.current = setTimeout(commitOpen, 100)
        else commitOpen()
      }
    },
    [clearCloseTimer, clearContentTimer, clearExitTimer, clearOpenTimer, openID, updateIndicator],
  )

  const toggle = useCallback(
    (id: string) => {
      clearOpenTimer()
      clearCloseTimer()
      if (openID === id) close()
      else {
        clearExitTimer()
        setMenuPhase('open')
        setOpenID(id)
        setRenderedID(id)
        setContentPhase('visible')
      }
      updateIndicator(id)
    },
    [clearCloseTimer, clearExitTimer, clearOpenTimer, close, openID, updateIndicator],
  )

  const ensureVisible = useCallback((id: string) => {
    userNavigationScrollRef.current = true
    itemRefs.current[id]?.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
  }, [])

  const updateOverflow = useCallback((alignToEnd = true) => {
    const strip = stripRef.current
    if (!strip) return
    const frameWidth = frameRef.current?.clientWidth
    const overflowing = isOverflowing(strip, frameWidth || strip.clientWidth)
    if (initializedOverflowKeyRef.current !== navigationKey) {
      initializedOverflowKeyRef.current = navigationKey
      userNavigationScrollRef.current = false
    }
    if (overflowing && alignToEnd && !userNavigationScrollRef.current) {
      const target = Math.max(0, strip.scrollWidth - strip.clientWidth)
      pendingAlignmentScrollRef.current = target
      strip.scrollLeft = target
    }
    setOverflow(overflowing)
    setAtStart(strip.scrollLeft <= 1)
    setAtEnd(strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1)
  }, [navigationKey])

  useEffect(() => onOpenChange?.(openID !== null), [onOpenChange, openID])
  useEffect(
    () => () => {
      clearOpenTimer()
      clearCloseTimer()
      clearExitTimer()
      clearContentTimer()
    },
    [clearCloseTimer, clearContentTimer, clearExitTimer, clearOpenTimer],
  )
  useEffect(() => {
    if (openID && !navItems.some((item) => item.id === openID && item.content?.length)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      close()
    }
  }, [close, navItems, openID])

  useLayoutEffect(() => {
    updateOverflow()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      updateOverflow()
      updateIndicator(indicatorOwnerRef.current, indicatorOwnerRef.current !== null)
    })
    if (stripRef.current) observer.observe(stripRef.current)
    if (trackRef.current) observer.observe(trackRef.current)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (frameRef.current) observer.observe(frameRef.current)
    return () => observer.disconnect()
  }, [updateIndicator, updateOverflow])

  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip || !overflow || userNavigationScrollRef.current) return
    const target = Math.max(0, strip.scrollWidth - strip.clientWidth)
    pendingAlignmentScrollRef.current = target
    strip.scrollLeft = target
    setAtStart(strip.scrollLeft <= 1)
    setAtEnd(strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1)
  }, [navigationKey, overflow])

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel || renderedID === null) return
    const scrollRegion = panel.querySelector<HTMLElement>('[data-mega-menu-scroll="true"]')
    if (!scrollRegion) return
    const updateHeight = () => setPanelHeight(scrollRegion.getBoundingClientRect().height)
    updateHeight()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(updateHeight)
    observer.observe(scrollRegion)
    return () => observer.disconnect()
  }, [renderedID])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onScroll = () => {
      const alignmentTarget = pendingAlignmentScrollRef.current
      if (alignmentTarget !== null && Math.abs(strip.scrollLeft - alignmentTarget) <= 1) {
        pendingAlignmentScrollRef.current = null
      } else {
        userNavigationScrollRef.current = true
      }
      suppressHoverRef.current = true
      updateOverflow(false)
      updateIndicator(indicatorOwnerRef.current, indicatorOwnerRef.current !== null)
    }
    strip.addEventListener('scroll', onScroll, { passive: true })
    return () => strip.removeEventListener('scroll', onScroll)
  }, [updateIndicator, updateOverflow])

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const onWheel = (event: WheelEvent) => {
      if (!overflow || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth)
      const movingLeft = event.deltaX < 0 && strip.scrollLeft > 0
      const movingRight = event.deltaX > 0 && strip.scrollLeft < maxScrollLeft
      if (!movingLeft && !movingRight) return
      event.preventDefault()
      userNavigationScrollRef.current = true
      suppressHoverRef.current = true
      strip.scrollLeft = Math.max(0, Math.min(maxScrollLeft, strip.scrollLeft + event.deltaX))
      updateOverflow(false)
      updateIndicator(indicatorOwnerRef.current, indicatorOwnerRef.current !== null)
    }
    strip.addEventListener('wheel', onWheel, { passive: false })
    return () => strip.removeEventListener('wheel', onWheel)
  }, [overflow, updateIndicator, updateOverflow])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    close()
  }, [close, pathname])

  useEffect(() => {
    const media = window.matchMedia?.('(width > 1170px)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) return
      const focused = document.activeElement
      const shouldHandoffFocus =
        ownsFocusRef.current || (focused instanceof Node && rootRef.current?.contains(focused))
      close()
      if (shouldHandoffFocus) {
        ownsFocusRef.current = false
        compactFocusTargetRef?.current?.focus()
      }
    }
    onChange(media)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [close, compactFocusTargetRef, rootRef])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !openID) return
      const owner = triggerRefs.current[openID]
      close()
      owner?.focus()
      owner?.scrollIntoView?.({ behavior: 'instant', block: 'nearest', inline: 'nearest' })
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        ownsFocusRef.current = false
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [close, openID, rootRef])

  const scrollToItem = (direction: 'left' | 'right') => {
    const strip = stripRef.current
    if (!strip) return
    userNavigationScrollRef.current = true
    const entries = navItems.map((item) => itemRefs.current[item.id]).filter(Boolean) as HTMLElement[]
    const viewportStart = strip.scrollLeft
    const viewportEnd = viewportStart + strip.clientWidth
    let target = direction === 'right' ? strip.scrollWidth - strip.clientWidth : 0
    if (direction === 'right') {
      const next = entries.find((entry) => entry.offsetLeft + entry.offsetWidth > viewportEnd + 1)
      if (next) target = Math.min(next.offsetLeft, strip.scrollWidth - strip.clientWidth)
    } else {
      const previous = entries.filter((entry) => entry.offsetLeft < viewportStart - 1).at(-1)
      if (previous) target = previous.offsetLeft
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    suppressHoverRef.current = true
    strip.scrollTo({ behavior: reduced ? 'auto' : 'smooth', left: target })
  }

  const renderedItem = navItems.find((item) => item.id === renderedID)
  const renderedMenuID = renderedItem ? `${idPrefix}-${renderedItem.id}-menu` : undefined

  return (
    <div
      className={styles.desktopNav}
      data-desktop-nav-root="true"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
        if (event.relatedTarget instanceof Node || window.matchMedia('(width > 1170px)').matches) {
          ownsFocusRef.current = false
        }
        if (!pointerInsideRef.current) scheduleClose()
      }}
      onFocusCapture={() => {
        ownsFocusRef.current = true
      }}
      onPointerEnter={(event) => {
        if ((event.target as Element).closest?.('[data-navigation-overlay="true"]')) {
          pointerInsideRef.current = false
          scheduleClose()
          return
        }
        pointerInsideRef.current = true
        clearCloseTimer()
      }}
      onPointerLeave={(event) => {
        const relatedElement = event.relatedTarget instanceof Element ? event.relatedTarget : null
        if (relatedElement?.closest('[data-navigation-overlay="true"]')) {
          pointerInsideRef.current = false
          scheduleClose()
          return
        }
        if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) {
          pointerInsideRef.current = true
          return
        }
        pointerInsideRef.current = false
        scheduleClose()
      }}
      ref={rootRef}
    >
      <div
        className={styles.primaryNavigationFrame}
        data-at-end={atEnd ? 'true' : 'false'}
        data-at-start={atStart ? 'true' : 'false'}
        data-navigation-frame="true"
        data-overflow={overflow ? 'true' : 'false'}
        ref={frameRef}
      >
        {overflow && (
          <button aria-label="Scroll navigation left" className={styles.scrollButton} disabled={atStart} onClick={() => scrollToItem('left')} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
        )}
        <div className={styles.primaryNavigationViewport} data-navigation-viewport="true" ref={viewportRef}>
          <nav aria-label="Primary" className={styles.primaryNavigation} data-overflow={overflow} ref={stripRef}>
            <div className={styles.primaryNavigationTrack} ref={trackRef}>
              {navItems.map((item) => {
                const hasMenu = item.navigationType !== 'directLink'
                const menuID = `${idPrefix}-${item.id}-menu`
                const enterItem = () => {
                  if (suppressHoverRef.current) return
                  updateIndicator(item.id)
                  if (hasMenu) open(item.id, openID === null)
                  else {
                    clearOpenTimer()
                    if (openID) scheduleClose()
                  }
                }
                return (
                  <span
                    className={styles.primaryNavigationItem}
                    data-nav-item-id={item.id}
                    key={item.id}
                    onFocus={() => {
                      clearCloseTimer()
                      ensureVisible(item.id)
                      updateIndicator(item.id)
                    }}
                    onPointerEnter={enterItem}
                    onPointerMove={() => {
                      if (!suppressHoverRef.current) return
                      suppressHoverRef.current = false
                      enterItem()
                    }}
                    ref={(node) => { itemRefs.current[item.id] = node }}
                  >
                    {item.navigationType === 'directLink' ? (
                      <NavigationLink className={styles.topLevelLink} link={item.link} />
                    ) : item.navigationType === 'directLinkAndDropdown' ? (
                      <Link
                        aria-controls={menuID}
                        aria-expanded={openID === item.id}
                        className={styles.topLevelLink}
                        href={item.link.href}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowDown') return
                          event.preventDefault()
                          open(item.id, false)
                        }}
                        onPointerEnter={enterItem}
                        ref={(node) => { triggerRefs.current[item.id] = node }}
                        {...(item.link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        aria-controls={menuID}
                        aria-expanded={openID === item.id}
                        className={styles.dropdownButton}
                        onClick={() => toggle(item.id)}
                        onPointerEnter={enterItem}
                        ref={(node) => { triggerRefs.current[item.id] = node }}
                        type="button"
                      >
                        {item.label}
                      </button>
                    )}
                  </span>
                )
              })}
            </div>
          </nav>
          <span aria-hidden="true" className={styles.navigationIndicator} data-navigation-indicator="true" data-visible={indicator.visible ? 'true' : 'false'} style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
        </div>
        {overflow && (
          <button aria-label="Scroll navigation right" className={styles.scrollButton} disabled={atEnd} onClick={() => scrollToItem('right')} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        )}
      </div>
      <div className={styles.actions}>
        <Link aria-label="Search" className={styles.searchLink} href="/search">
          <SearchIcon aria-hidden="true" size={19} strokeWidth={1.75} />
        </Link>
        {menuCta && <NavigationLink className={styles.menuCta} link={menuCta} />}
      </div>
      {renderedItem?.content && renderedItem.content.length > 0 && renderedMenuID && (
        <div
          aria-hidden={menuPhase === 'closing' ? 'true' : undefined}
          className={styles.megaMenuShell}
          data-content-phase={contentPhase}
          data-mega-menu-shell="true"
          data-phase={menuPhase}
        >
          <button
            aria-label="Close navigation menu"
            className={styles.pageOverlay}
            data-navigation-overlay="true"
            onClick={close}
            onPointerEnter={() => {
              pointerInsideRef.current = false
              scheduleClose()
            }}
            tabIndex={-1}
            type="button"
          />
          <div
            className={styles.megaMenuContent}
            onPointerEnter={() => {
              pointerInsideRef.current = true
              clearCloseTimer()
            }}
          >
            <DesktopMegaMenu
              blocks={renderedItem.content}
              id={renderedMenuID}
              label={renderedItem.label}
              menuRef={panelRef}
              style={panelHeight === null ? undefined : { height: panelHeight }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
