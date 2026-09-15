import React from 'react'

import type { HeaderNavigationBlockData } from './types'
import { NavigationBlocks } from './NavigationBlocks'
import styles from './index.module.css'

type DesktopMegaMenuProps = {
  blocks: HeaderNavigationBlockData[]
  id: string
  label: string
}

export const DesktopMegaMenu: React.FC<DesktopMegaMenuProps> = ({ blocks, id, label }) => (
  <section aria-label={`${label} menu`} className={styles.megaMenu} id={id} role="region">
    <div className={`site-container ${styles.megaMenuInner}`}>
      <NavigationBlocks blocks={blocks} mode="desktop" />
    </div>
  </section>
)
