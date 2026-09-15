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
  maxPanelHeight?: number
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
  maxPanelHeight = 576,
}) => {
  const firstID = block.categories[0]?.id ?? null
  const [internalActive, setInternalActive] = useState<string | null>(firstID)
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null)
  const [visitedHeight, setVisitedHeight] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const activeID = activeCategoryId === undefined ? internalActive : activeCategoryId
  const expandedID = expandedCategoryId === undefined ? internalExpanded : expandedCategoryId
  const active = block.categories.find((category) => category.id === activeID) ?? block.categories[0]

  const select = (id: string) => {
    setInternalActive(id)
    onActiveCategoryChange?.(id)
  }
  const toggle = (id: string) => {
    const next = expandedID === id ? null : id
    setInternalExpanded(next)
    onExpandedCategoryChange?.(next)
  }

  useEffect(() => {
    if (mode !== 'desktop' || !sessionOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisitedHeight(0)
      return
    }
    const measure = () => {
      const panel = panelRef.current
      if (!panel) return
      const next = Math.min(maxPanelHeight, Math.max(panel.scrollHeight, panel.clientHeight))
      setVisitedHeight((current) => {
        const height = Math.max(current, next)
        if (height !== current) onSessionHeightChange?.(height)
        return height
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [active?.id, maxPanelHeight, mode, onSessionHeightChange, sessionOpen])

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
      <div className={styles.categorySelector} role="tablist" aria-label="Categories">
        {block.categories.map((category) => (
          <button
            aria-selected={category.id === active.id}
            aria-controls={`${block.id}-panel`}
            aria-expanded={category.id === active.id}
            className={category.id === active.id ? styles.categoryTabActive : styles.categoryTab}
            key={category.id}
            onClick={() => select(category.id)}
            onMouseEnter={() => select(category.id)}
            role="tab"
            type="button"
          >
            {category.label}
          </button>
        ))}
        {block.cta && <CategoryCTA link={block.cta} />}
      </div>
      <div className={styles.categoryPanel} id={`${block.id}-panel`} ref={panelRef} role="tabpanel" style={visitedHeight ? { maxHeight: maxPanelHeight, minHeight: visitedHeight } : undefined} tabIndex={0}>
        <div className={styles.productCardGrid}>
          {active.cards.map((card) => <NavigationCard card={card} key={card.id} />)}
        </div>
        {active.cta && <CategoryCTA link={active.cta} />}
      </div>
    </section>
  )
}

const CategoryCTA: React.FC<{ link: HeaderCategoryTabsBlockData['cta'] }> = ({ link }) =>
  link ? <NavigationLink className={styles.navigationCTA} link={link}>{link.label} <span aria-hidden="true">→</span></NavigationLink> : null
