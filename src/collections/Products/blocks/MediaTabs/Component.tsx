import React from 'react'
import type { ProductMediaTabsBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { Entrance } from '../shared/Entrance'
import blockStyles from '../shared/Block.module.css'
import { Tabs } from './Tabs'
import styles from './Component.module.css'

export function Component({ title, tabs, aspectRatio }: ProductMediaTabsBlock) {
  if (!tabs?.length) return null
  return (
    <div className={blockStyles.root}>
      <Entrance blockType="productMediaTabs" className={styles.container}>
        <ProductBlockHeader title={title} />
        <Tabs tabs={tabs} aspectRatio={aspectRatio} label={title || 'Product media views'} />
      </Entrance>
    </div>
  )
}
