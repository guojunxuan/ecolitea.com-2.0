'use client'

import { ChevronDown } from 'lucide-react'
import React, { useState } from 'react'

import type { HeaderCategoryTabsBlockData } from './types'
import { NavigationCard } from './NavigationCard'
import styles from './blocks.module.css'

type CategoryTabsProps = {
  block: HeaderCategoryTabsBlockData
  mode?: 'compact' | 'desktop'
  activeCategoryId?: string | null
  expandedCategoryId?: string | null
  onActiveCategoryChange?: (id: string) => void
  onExpandedCategoryChange?: (id: string | null) => void
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategoryId,
  block,
  expandedCategoryId,
  mode = 'desktop',
  onActiveCategoryChange,
  onExpandedCategoryChange,
}) => {
  const firstID = block.categories[0]?.id ?? null
  const [internalActive, setInternalActive] = useState<string | null>(firstID)
  const [internalExpanded, setInternalExpanded] = useState<string | null>(null)
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

  if (!active) return null

  if (mode === 'compact') {
    return (
      <section className={styles.categoryTabsCompact}>
        {block.categories.map((category) => {
          const open = expandedID === category.id
          return (
            <div className={styles.categoryAccordion} key={category.id}>
              <button
                aria-expanded={open}
                className={styles.categoryAccordionButton}
                onClick={() => toggle(category.id)}
                type="button"
              >
                {category.label}
                <ChevronDown aria-hidden="true" className={open ? styles.categoryChevronOpen : undefined} size={18} />
              </button>
              {open && (
                <div className={styles.categoryAccordionContent}>
                  <div className={styles.productCardGrid}>
                    {category.cards.map((card) => <NavigationCard card={card} key={card.id} />)}
                  </div>
                  {category.cta && <CategoryCTA link={category.cta} />}
                </div>
              )}
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
            aria-controls={`${block.id}-panel-${category.id}`}
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
      <div className={styles.categoryPanel} id={`${block.id}-panel-${active.id}`} role="tabpanel" tabIndex={0}>
        <div className={styles.productCardGrid}>
          {active.cards.map((card) => <NavigationCard card={card} key={card.id} />)}
        </div>
        {active.cta && <CategoryCTA link={active.cta} />}
      </div>
    </section>
  )
}

const CategoryCTA: React.FC<{ link: HeaderCategoryTabsBlockData['cta'] }> = ({ link }) =>
  link ? <a className={styles.navigationCTA} href={link.href} {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}>{link.label} <span aria-hidden="true">→</span></a> : null
