'use client'

import { ChevronDown, SearchIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { DesktopMegaMenu } from './DesktopMegaMenu'
import type { HeaderLinkData, HeaderNavigationData, HeaderNavigationItem } from './types'
import styles from './index.module.css'

const ITEM_GAP = 24
const MORE_WIDTH_FALLBACK = 80

const NavigationLink: React.FC<{
  anchorRef?: React.Ref<HTMLAnchorElement>
  className?: string
  link: HeaderLinkData
}> = ({ anchorRef, className, link }) => (
  <Link
    className={className}
    href={link.href}
    ref={anchorRef}
    {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
  >
    {link.label}
  </Link>
)

type NavigationItemControlProps = {
  controlRef?: (node: HTMLElement | null) => void
  item: HeaderNavigationItem
  menuID: string
  onToggle: () => void
  open: boolean
}

const NavigationItemControl: React.FC<NavigationItemControlProps> = ({
  controlRef,
  item,
  menuID,
  onToggle,
  open,
}) => {
  if (item.navigationType === 'directLink' && item.link) {
    return (
      <NavigationLink anchorRef={controlRef} className={styles.topLevelLink} link={item.link} />
    )
  }

  if (item.navigationType === 'directLinkAndDropdown' && item.link) {
    return (
      <span className={styles.hybridControl}>
        <NavigationLink className={styles.topLevelLink} link={item.link} />
        <button
          aria-controls={menuID}
          aria-expanded={open}
          aria-label={`${item.label} menu`}
          className={styles.disclosureButton}
          onClick={onToggle}
          ref={controlRef}
          type="button"
        >
          <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
        </button>
      </span>
    )
  }

  return (
    <button
      aria-controls={menuID}
      aria-expanded={open}
      aria-label={`${item.label} menu`}
      className={styles.dropdownButton}
      onClick={onToggle}
      ref={controlRef}
      type="button"
    >
      <span>{item.label}</span>
      <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
    </button>
  )
}

export const DesktopNav: React.FC<HeaderNavigationData> = ({ menuCta, navItems }) => {
  const pathname = usePathname()
  const idPrefix = useId().replaceAll(':', '')
  const rootRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const measureItemRefs = useRef<Array<HTMLSpanElement | null>>([])
  const measureMoreRef = useRef<HTMLSpanElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const itemControlRefs = useRef<Record<string, HTMLElement | null>>({})
  const previousVisibleCountRef = useRef(navItems.length)
  const [openID, setOpenID] = useState<string | null>(null)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const [overflowOpenID, setOverflowOpenID] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(navItems.length)

  const close = useCallback(() => {
    setOpenID(null)
    setIsMoreOpen(false)
    setOverflowOpenID(null)
  }, [])

  const recalculate = useCallback(() => {
    const root = rootRef.current
    if (!root) return

    const actionsWidth = actionsRef.current?.getBoundingClientRect().width ?? 0
    const availableWidth = root.getBoundingClientRect().width - actionsWidth - ITEM_GAP
    const itemWidths = navItems.map(
      (_, index) => measureItemRefs.current[index]?.getBoundingClientRect().width ?? 0,
    )
    if (availableWidth <= 0 || itemWidths.every((width) => width <= 0)) {
      setVisibleCount(navItems.length)
      return
    }
    const moreWidth = measureMoreRef.current?.getBoundingClientRect().width || MORE_WIDTH_FALLBACK
    const totalWidth =
      itemWidths.reduce((sum, width) => sum + width, 0) +
      Math.max(0, itemWidths.length - 1) * ITEM_GAP

    if (totalWidth <= availableWidth) {
      setVisibleCount(navItems.length)
      return
    }

    let usedWidth = 0
    let nextVisibleCount = 0
    for (const width of itemWidths) {
      const widthWithGap = nextVisibleCount === 0 ? width : width + ITEM_GAP
      const moreWithGap = nextVisibleCount === 0 ? moreWidth : moreWidth + ITEM_GAP
      if (usedWidth + widthWithGap + moreWithGap > availableWidth) break
      usedWidth += widthWithGap
      nextVisibleCount += 1
    }
    setVisibleCount(nextVisibleCount)
  }, [navItems])

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }

    recalculate()
    const observer = new ResizeObserver(recalculate)
    if (rootRef.current) observer.observe(rootRef.current)
    if (actionsRef.current) observer.observe(actionsRef.current)
    return () => observer.disconnect()
  }, [navItems, recalculate])

  useEffect(() => {
    // The router pathname is external state; dismiss transient navigation after it changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    close()
  }, [close, pathname])

  useLayoutEffect(() => {
    const previousVisibleCount = previousVisibleCountRef.current
    if (previousVisibleCount === visibleCount) return
    previousVisibleCountRef.current = visibleCount

    const activeOwnerID = overflowOpenID ?? openID
    const hadOpenLayer = Boolean(activeOwnerID || isMoreOpen)
    if (!hadOpenLayer) return

    const ownerIndex = activeOwnerID ? navItems.findIndex((item) => item.id === activeOwnerID) : -1
    const ownerIsOverflowed = ownerIndex >= visibleCount && visibleCount < navItems.length
    const focusTarget = ownerIsOverflowed
      ? moreButtonRef.current
      : activeOwnerID
        ? itemControlRefs.current[activeOwnerID]
        : visibleCount < navItems.length
          ? moreButtonRef.current
          : (itemControlRefs.current[navItems[previousVisibleCount]?.id ?? ''] ?? rootRef.current)

    // This state transition synchronizes open layers with ResizeObserver-derived ownership.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    close()
    focusTarget?.focus()
  }, [close, isMoreOpen, navItems, openID, overflowOpenID, visibleCount])

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 73.125rem)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if (!event.matches) close()
    }
    onChange(media)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [close])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (overflowOpenID) {
        const trigger = itemControlRefs.current[overflowOpenID]
        trigger?.focus()
        setOverflowOpenID(null)
        return
      }
      if (isMoreOpen) {
        moreButtonRef.current?.focus()
        setIsMoreOpen(false)
        return
      }
      const trigger = openID ? itemControlRefs.current[openID] : null
      trigger?.focus()
      setOpenID(null)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close()
    }
    const interactionBoundary = rootRef.current?.closest('header') ?? rootRef.current
    const onFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && interactionBoundary?.contains(nextTarget)) return
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    interactionBoundary?.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      interactionBoundary?.removeEventListener('focusout', onFocusOut)
    }
  }, [close, isMoreOpen, openID, overflowOpenID])

  const visibleItems = navItems.slice(0, visibleCount)
  const overflowItems = navItems.slice(visibleCount)
  const activeID = overflowOpenID ?? openID
  const activeItem = navItems.find((item) => item.id === activeID)
  const activeMenuID = activeItem ? `${idPrefix}-${activeItem.id}-menu` : null
  const moreMenuID = `${idPrefix}-more-menu`

  return (
    <div className={styles.desktopNav} data-desktop-nav-root="true" ref={rootRef}>
      <div aria-hidden="true" className={styles.measurementRow}>
        {navItems.map((item, index) => (
          <span
            data-measure-item="true"
            key={item.id}
            ref={(node) => {
              measureItemRefs.current[index] = node
            }}
          >
            {item.navigationType === 'directLink' ? (
              <span className={styles.topLevelLink}>{item.label}</span>
            ) : item.navigationType === 'directLinkAndDropdown' ? (
              <span className={styles.hybridControl}>
                <span className={styles.topLevelLink}>{item.label}</span>
                <span className={styles.disclosureButton}>
                  <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
                </span>
              </span>
            ) : (
              <span className={styles.dropdownButton}>
                <span>{item.label}</span>
                <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
              </span>
            )}
          </span>
        ))}
        <span data-measure-more="true" ref={measureMoreRef}>
          <span className={styles.dropdownButton}>
            <span>More</span>
            <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
          </span>
        </span>
      </div>

      <nav aria-label="Primary" className={styles.primaryNavigation}>
        {visibleItems.map((item) => {
          const menuID = `${idPrefix}-${item.id}-menu`
          return (
            <NavigationItemControl
              controlRef={(node) => {
                itemControlRefs.current[item.id] = node
              }}
              item={item}
              key={item.id}
              menuID={menuID}
              onToggle={() => {
                setIsMoreOpen(false)
                setOverflowOpenID(null)
                setOpenID((current) => (current === item.id ? null : item.id))
              }}
              open={openID === item.id}
            />
          )
        })}
        {overflowItems.length > 0 && (
          <button
            aria-controls={moreMenuID}
            aria-expanded={isMoreOpen}
            aria-label="More menu"
            className={styles.dropdownButton}
            onClick={() => {
              setOpenID(null)
              setOverflowOpenID(null)
              setIsMoreOpen((current) => !current)
            }}
            ref={moreButtonRef}
            type="button"
          >
            <span>More</span>
            <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} />
          </button>
        )}
      </nav>

      <div className={styles.actions} ref={actionsRef}>
        <Link aria-label="Search" className={styles.searchLink} href="/search">
          <SearchIcon aria-hidden="true" size={19} strokeWidth={1.75} />
        </Link>
        {menuCta && <NavigationLink className={styles.menuCta} link={menuCta} />}
      </div>

      {isMoreOpen && overflowItems.length > 0 && (
        <section aria-label="More menu" className={styles.moreMenu} id={moreMenuID} role="region">
          {overflowItems.map((item) => {
            const menuID = `${idPrefix}-${item.id}-menu`
            return (
              <NavigationItemControl
                controlRef={(node) => {
                  itemControlRefs.current[item.id] = node
                }}
                item={item}
                key={item.id}
                menuID={menuID}
                onToggle={() => {
                  setOpenID(null)
                  setOverflowOpenID((current) => (current === item.id ? null : item.id))
                }}
                open={overflowOpenID === item.id}
              />
            )
          })}
        </section>
      )}

      {activeItem?.dropdown && activeMenuID && (
        <DesktopMegaMenu
          dropdown={activeItem.dropdown}
          id={activeMenuID}
          label={activeItem.label}
        />
      )}
    </div>
  )
}
