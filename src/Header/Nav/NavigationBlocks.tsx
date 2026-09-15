import React from 'react'

import type { HeaderLinkData, HeaderNavigationBlockData } from './types'
import { CategoryTabs } from './CategoryTabs'
import { NavigationCard } from './NavigationCard'
import styles from './blocks.module.css'

type NavigationBlocksProps = { blocks: HeaderNavigationBlockData[]; mode?: 'compact' | 'desktop' }

const CTA: React.FC<{ link: HeaderLinkData | null }> = ({ link }) =>
  link ? <a className={styles.navigationCTA} href={link.href} {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}>{link.label} <span aria-hidden="true">→</span></a> : null

export const NavigationBlocks: React.FC<NavigationBlocksProps> = ({ blocks, mode = 'desktop' }) => (
  <div className={`${styles.navigationBlocks} ${mode === 'compact' ? styles.navigationBlocksCompact : ''}`}>
    {blocks.map((block) => {
      if (block.type === 'categoryTabs') return <CategoryTabs block={block} key={block.id} mode={mode} />
      if (block.type === 'cardGroup') return (
        <section className={styles.cardGroup} key={block.id}>
          {block.heading && <h2 className={styles.blockHeading}>{block.heading}</h2>}
          <div className={styles.visualCardGrid}>{block.cards.map((card) => <NavigationCard card={card} key={card.id} variant="visual" />)}</div>
          <CTA link={block.cta} />
        </section>
      )
      if (block.type === 'linkGroup') return (
        <section className={styles.linkGroup} key={block.id}>
          {block.heading && <h2 className={styles.blockHeading}>{block.heading}</h2>}
          <div className={styles.linkList}>{block.links.map(({ id, link }) => <a href={link.href} key={id} {...(link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {})}>{link.label}</a>)}</div>
        </section>
      )
      return (
        <section className={styles.richCardGroup} key={block.id}>
          <NavigationCard card={block.card} description={block.description} variant="rich" />
        </section>
      )
    })}
  </div>
)

