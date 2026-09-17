import React from 'react'

import type { HeaderNavigationBlockData } from './types'
import { NavigationBlocks } from './NavigationBlocks'
import styles from './index.module.css'

type DesktopMegaMenuProps = {
  blocks: HeaderNavigationBlockData[]
  id: string
  label: string
  menuRef?: React.Ref<HTMLElement>
  style?: React.CSSProperties
}

export const DesktopMegaMenu: React.FC<DesktopMegaMenuProps> = ({ blocks, id, label, menuRef, style }) => (
  <section aria-label={`${label} menu`} className={styles.megaMenu} id={id} ref={menuRef} role="region" style={style}>
    <div
      className={`site-container ${styles.megaMenuInner}`}
      data-mega-menu-scroll="true"
      onWheel={(event) => {
        const region = event.currentTarget
        const atTop = region.scrollTop <= 0
        const atBottom = region.scrollTop + region.clientHeight >= region.scrollHeight - 1
        if (!((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom))) return
        event.preventDefault()
        window.scrollBy({ behavior: 'auto', top: event.deltaY })
      }}
    >
      <NavigationBlocks blocks={blocks} mode="desktop" />
    </div>
  </section>
)
