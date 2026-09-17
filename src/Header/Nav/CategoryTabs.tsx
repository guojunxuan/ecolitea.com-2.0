'use client'

import { ChevronDown } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import type { HeaderCategoryTabsBlockData } from './types'
import { NavigationCard } from './NavigationCard'
import styles from './blocks.module.css'
import { NavigationLink } from './NavigationLink'

type CategoryTabsProps = {
  block: HeaderCategoryTabsBlockData
  mode?: 'compact' | 'desktop'
  activeCategoryId?: string | null
  expandedCategoryId?: string | null
  onActiveCategoryChange?: (id: string) => void
  onExpandedCategoryChange?: (id: string | null) => void
  onSessionHeightChange?: (height: number) => void
  sessionOpen?: boolean
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategoryId,
  block,
  expandedCategoryId,
  mode = 'desktop',
  onActiveCategoryChange,
  onExpandedCategoryChange,
  onSessionHeightChange,
  sessionOpen = true,
}) => {
  const firstID = block.categories[0]?.id ?? null
  const [internalActive, setInternalActive] = useState<string | null>(firstID)
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null)
  const [visitedHeight, setVisitedHeight] = useState(0)
  const [selectorAvailableHeight, setSelectorAvailableHeight] = useState<number | null>(null)
  const [selectorFits, setSelectorFits] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const selectorColumnRef = useRef<HTMLElement>(null)
  const selectorListRef = useRef<HTMLDivElement>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeID = activeCategoryId === undefined ? internalActive : activeCategoryId
  const expandedID = expandedCategoryId === undefined ? internalExpanded : expandedCategoryId
  const active = block.categories.find((category) => category.id === activeID) ?? block.categories[0]

  const select = (id: string) => {
    setInternalActive(id)
    onActiveCategoryChange?.(id)
  }
  const clearHoverTimer = () => {
    if (hoverTimerRef.current === null) return
    clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }
  const selectImmediately = (id: string) => {
    clearHoverTimer()
    select(id)
  }
  const selectWithIntent = (id: string) => {
    clearHoverTimer()
    if (id === active?.id) return
    hoverTimerRef.current = setTimeout(() => {
      hoverTimerRef.current = null
      select(id)
    }, 100)
  }
  const toggle = (id: string) => {
    const next = expandedID === id ? null : id
    setInternalExpanded(next)
    onExpandedCategoryChange?.(next)
  }

  useEffect(() => () => {
    if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current)
  }, [])

  useEffect(() => {
    if (mode !== 'desktop' || !sessionOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisitedHeight(0)
      return
    }
    const measure = () => {
      const panel = panelRef.current
      if (!panel) return
      const next = Math.max(panel.scrollHeight, panel.clientHeight)
      setVisitedHeight((current) => {
        const height = Math.max(current, next)
        if (height !== current) onSessionHeightChange?.(height)
        return height
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [active?.id, mode, onSessionHeightChange, sessionOpen])

  useEffect(() => {
    if (mode !== 'desktop' || !sessionOpen) return
    const column = selectorColumnRef.current
    const selectorList = selectorListRef.current
    if (!column || !selectorList) return
    const scrollport = column.closest<HTMLElement>('[data-mega-menu-scroll="true"]')
    const measure = () => {
      const availableHeight = (() => {
        if (!scrollport || scrollport.clientHeight === 0) {
          return Math.max(0, window.innerHeight - Math.max(0, column.getBoundingClientRect().top))
        }
        const style = window.getComputedStyle(scrollport)
        const paddingTop = Number.parseFloat(style.paddingTop) || 0
        const paddingBottom = Number.parseFloat(style.paddingBottom) || 0
        return Math.max(0, scrollport.clientHeight - paddingTop - paddingBottom)
      })()
      const columnStyle = window.getComputedStyle(column)
      const columnPadding =
        (Number.parseFloat(columnStyle.paddingTop) || 0) +
        (Number.parseFloat(columnStyle.paddingBottom) || 0)
      const primaryCTA = column.querySelector<HTMLElement>(`.${styles.categoryPrimaryCTA}`)
      const intrinsicHeight =
        columnPadding +
        Math.max(selectorList.scrollHeight, selectorList.clientHeight, selectorList.offsetHeight) +
        (primaryCTA
          ? Math.max(primaryCTA.scrollHeight, primaryCTA.clientHeight, primaryCTA.offsetHeight)
          : 0)
      setSelectorAvailableHeight(availableHeight)
      setSelectorFits(intrinsicHeight <= availableHeight)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (scrollport) observer?.observe(scrollport)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [active?.id, mode, sessionOpen])

  if (!active) return null

  if (mode === 'compact') {
    return (
      <section className={styles.categoryTabsCompact}>
        {block.categories.map((category) => {
          const open = expandedID === category.id
          return (
            <div className={styles.categoryAccordion} key={category.id}>
              <button
                aria-controls={`${block.id}-compact-panel-${category.id}`}
                aria-expanded={open}
                className={styles.categoryAccordionButton}
                onClick={() => toggle(category.id)}
                type="button"
              >
                {category.label}
                <ChevronDown aria-hidden="true" className={open ? styles.categoryChevronOpen : undefined} size={18} />
              </button>
              <div className={styles.categoryAccordionContent} hidden={!open} id={`${block.id}-compact-panel-${category.id}`}>
                {open && (
                  <div className={styles.productCardGrid}>
                    {category.cards.map((card) => <NavigationCard card={card} key={card.id} />)}
                  </div>
                )}
                {open && category.cta && <CategoryCTA link={category.cta} />}
              </div>
            </div>
          )
        })}
        {block.cta && <CategoryCTA link={block.cta} />}
      </section>
    )
  }

  return (
    <section className={styles.categoryTabsDesktop}>
      <aside
        className={`${styles.categorySelectorColumn} ${selectorFits ? styles.categorySelectorColumnSticky : ''}`}
        data-category-selector-column
        data-sticky={selectorFits ? 'true' : 'false'}
        ref={selectorColumnRef}
        style={selectorFits && selectorAvailableHeight !== null ? { maxHeight: selectorAvailableHeight } : undefined}
      >
        <div className={styles.categorySelector} ref={selectorListRef} role="tablist" aria-label="Categories">
          {block.categories.map((category) => (
            <button
              aria-selected={category.id === active.id}
              aria-controls={`${block.id}-panel`}
              aria-expanded={category.id === active.id}
              className={category.id === active.id ? styles.categoryTabActive : styles.categoryTab}
              key={category.id}
              onClick={() => selectImmediately(category.id)}
              onPointerEnter={() => selectWithIntent(category.id)}
              onPointerLeave={clearHoverTimer}
              role="tab"
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
        {block.cta && <CategoryCTA className={styles.categoryPrimaryCTA} link={block.cta} />}
      </aside>
      <div className={styles.categoryContent}>
        <div className={styles.categoryBlockHeader} data-category-product-header>
          <h2 className={styles.categoryHeading}>{active.label}</h2>
          {active.cta && <CategoryCTA className={styles.categoryActiveCTA} link={active.cta} />}
        </div>
        <div className={styles.categoryPanel} id={`${block.id}-panel`} ref={panelRef} role="tabpanel" style={visitedHeight ? { minHeight: visitedHeight } : undefined} tabIndex={0}>
          <div className={styles.productCardGrid} data-product-card-grid>
            {active.cards.map((card) => <NavigationCard card={card} key={card.id} />)}
          </div>
        </div>
      </div>
    </section>
  )
}

const CategoryCTA: React.FC<{ className?: string; link: HeaderCategoryTabsBlockData['cta'] }> = ({ className, link }) =>
  link ? (
    <NavigationLink className={`${styles.navigationCTA} ${className ?? ''}`} link={link}>
      {link.label}
    </NavigationLink>
  ) : null
