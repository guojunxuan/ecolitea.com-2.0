import React from 'react'

import type { HeaderLinkData, HeaderNavigationBlockData } from './types'
import { CategoryTabs } from './CategoryTabs'
import { NavigationCard } from './NavigationCard'
import styles from './blocks.module.css'
import { NavigationLink } from './NavigationLink'

type NavigationBlocksProps = {
  blocks: HeaderNavigationBlockData[]
  compactAccordion?: Record<string, string | null>
  mode?: 'compact' | 'desktop'
  onCompactAccordionChange?: (blockId: string, categoryId: string | null) => void
}

const CTA: React.FC<{ className?: string; link: HeaderLinkData | null }> = ({ className, link }) =>
  link ? <NavigationLink className={className} link={link}>{link.label}</NavigationLink> : null

const BlockHeader: React.FC<{ cta?: HeaderLinkData | null; heading: string | null }> = ({ cta = null, heading }) =>
  heading || cta ? (
    <div className={styles.blockHeader}>
      {heading ? <h2 className={styles.blockHeading}>{heading}</h2> : <span />}
      <CTA className={styles.blockCTA} link={cta} />
    </div>
  ) : null

const visualGrid = (count: number, mode: 'compact' | 'desktop') =>
  count === 1
    ? { className: styles.visualGridOne, size: '(max-width: 360px) 100vw, (max-width: 1170px) 100vw, 50vw' }
    : mode === 'compact'
      ? { className: count === 2 ? styles.visualGridTwo : styles.visualGridMany, size: '(max-width: 360px) 100vw, (max-width: 1170px) 50vw, 25vw' }
    : count === 2
      ? { className: styles.visualGridTwo, size: '(max-width: 360px) 100vw, (max-width: 767px) 50vw, 25vw' }
      : { className: styles.visualGridMany, size: '(max-width: 360px) 100vw, (max-width: 767px) 50vw, (max-width: 1099px) 33vw, 25vw' }

export const NavigationBlocks: React.FC<NavigationBlocksProps> = ({
  blocks,
  compactAccordion,
  mode = 'desktop',
  onCompactAccordionChange,
}) => (
  <div className={`${styles.navigationBlocks} ${mode === 'compact' ? styles.navigationBlocksCompact : ''}`}>
    {blocks.map((block) => {
      if (block.type === 'categoryTabs') return <section className={styles.categoryBlock} data-navigation-block={block.type} key={block.id}><CategoryTabs block={block} expandedCategoryId={compactAccordion?.[block.id]} mode={mode} onExpandedCategoryChange={(id) => onCompactAccordionChange?.(block.id, id)} /></section>
      if (block.type === 'cardGroup') {
        const grid = visualGrid(block.cards.length, mode)
        return (
        <section className={`${styles.cardGroup} ${block.cards.length <= 2 ? styles.cardGroupTwo : styles.cardGroupFull}`} data-block-layout={`cardGroup-${block.cards.length <= 2 ? 'two' : 'full'}`} data-card-count={block.cards.length} data-navigation-block={block.type} key={block.id}>
          <BlockHeader cta={block.cta} heading={block.heading} />
          <div className={`${styles.visualCardGrid} ${grid.className}`}>{block.cards.map((card) => <NavigationCard card={card} key={card.id} mode={mode} size={grid.size} variant="visual" />)}</div>
        </section>
        )
      }
      if (block.type === 'linkGroup') return (
        <section className={styles.linkGroup} data-block-layout="linkGroup-one" data-navigation-block={block.type} key={block.id}>
          <BlockHeader heading={block.heading} />
          <div className={styles.linkList}>{block.links.map(({ id, link }) => <NavigationLink key={id} link={link} />)}</div>
        </section>
      )
      if (block.type === 'richCard') return (
        <section className={styles.richCardGroup} data-block-layout="richCard-two" data-navigation-block={block.type} key={block.id}>
          <NavigationCard card={block.card} description={block.description} mode={mode} variant="rich" />
        </section>
      )
      return null
    })}
  </div>
)
