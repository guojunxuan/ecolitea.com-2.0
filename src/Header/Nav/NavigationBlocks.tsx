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

const CTA: React.FC<{ link: HeaderLinkData | null }> = ({ link }) =>
  link ? <NavigationLink className={styles.navigationCTA} link={link}>{link.label} <span aria-hidden="true">→</span></NavigationLink> : null

export const NavigationBlocks: React.FC<NavigationBlocksProps> = ({
  blocks,
  compactAccordion,
  mode = 'desktop',
  onCompactAccordionChange,
}) => (
  <div className={`${styles.navigationBlocks} ${mode === 'compact' ? styles.navigationBlocksCompact : ''}`}>
    {blocks.map((block) => {
      if (block.type === 'categoryTabs') return <section className={styles.categoryBlock} data-navigation-block={block.type} key={block.id}><CategoryTabs block={block} expandedCategoryId={compactAccordion?.[block.id]} mode={mode} onExpandedCategoryChange={(id) => onCompactAccordionChange?.(block.id, id)} /></section>
      if (block.type === 'cardGroup') return (
        <section className={`${styles.cardGroup} ${block.cards.length <= 2 ? styles.cardGroupTwo : styles.cardGroupFull}`} data-block-layout={`cardGroup-${block.cards.length <= 2 ? 'two' : 'full'}`} data-navigation-block={block.type} key={block.id}>
          {block.heading && <h2 className={styles.blockHeading}>{block.heading}</h2>}
          <div className={styles.visualCardGrid}>{block.cards.map((card) => <NavigationCard card={card} key={card.id} variant="visual" />)}</div>
          <CTA link={block.cta} />
        </section>
      )
      if (block.type === 'linkGroup') return (
        <section className={styles.linkGroup} data-block-layout="linkGroup-one" data-navigation-block={block.type} key={block.id}>
          {block.heading && <h2 className={styles.blockHeading}>{block.heading}</h2>}
          <div className={styles.linkList}>{block.links.map(({ id, link }) => <NavigationLink key={id} link={link} />)}</div>
        </section>
      )
      if (block.type === 'richCard') return (
        <section className={styles.richCardGroup} data-block-layout="richCard-two" data-navigation-block={block.type} key={block.id}>
          <NavigationCard card={block.card} description={block.description} variant="rich" />
        </section>
      )
      return null
    })}
  </div>
)
