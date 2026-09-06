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
  className?: string
  link: HeaderLinkData
}> = ({ className, link }) => (
  <Link
    className={className}
    href={link.href}
    {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
  >
    {link.label}
  </Link>
)

type NavigationItemControlProps = {
  item: HeaderNavigationItem
  menuID: string
  onToggle: () => void
  open: boolean
}

const NavigationItemControl: React.FC<NavigationItemControlProps> = ({
  item,
  menuID,
  onToggle,
  open,
}) => {
  if (item.navigationType === 'directLink' && item.link) {
    return <NavigationLink className={styles.topLevelLink} link={item.link} />
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
  const [openID, setOpenID] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(navItems.length)

  const close = useCallback(() => setOpenID(null), [])

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
      setVisibleCount(navItems.length)
      return
    }

    recalculate()
    const observer = new ResizeObserver(recalculate)
    if (rootRef.current) observer.observe(rootRef.current)
    if (actionsRef.current) observer.observe(actionsRef.current)
    return () => observer.disconnect()
  }, [navItems, recalculate])

  useEffect(() => close(), [close, pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [close])

  const visibleItems = navItems.slice(0, visibleCount)
  const overflowItems = navItems.slice(visibleCount)
  const activeItem = navItems.find((item) => item.id === openID)
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
            {item.label}
          </span>
        ))}
        <span data-measure-more="true" ref={measureMoreRef}>
          More
        </span>
      </div>

      <nav aria-label="Primary" className={styles.primaryNavigation}>
        {visibleItems.map((item) => {
          const menuID = `${idPrefix}-${item.id}-menu`
          return (
            <NavigationItemControl
              item={item}
              key={item.id}
              menuID={menuID}
              onToggle={() => setOpenID((current) => (current === item.id ? null : item.id))}
              open={openID === item.id}
            />
          )
        })}
        {overflowItems.length > 0 && (
          <button
            aria-controls={moreMenuID}
            aria-expanded={openID === 'more'}
            aria-label="More menu"
            className={styles.dropdownButton}
            onClick={() => setOpenID((current) => (current === 'more' ? null : 'more'))}
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

      {openID === 'more' && overflowItems.length > 0 && (
        <section aria-label="More menu" className={styles.moreMenu} id={moreMenuID} role="region">
          {overflowItems.map((item) => {
            const menuID = `${idPrefix}-${item.id}-menu`
            return (
              <NavigationItemControl
                item={item}
                key={item.id}
                menuID={menuID}
                onToggle={() => setOpenID(item.id)}
                open={false}
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
