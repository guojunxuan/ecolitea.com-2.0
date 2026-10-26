import React from 'react'
import type { ProductMediaCarouselBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { Entrance } from '../shared/Entrance'
import blockStyles from '../shared/Block.module.css'
import { Carousel } from './Carousel'
import styles from './Component.module.css'

export function Component({
  theme,
  eyebrow,
  title,
  slides,
  aspectRatio,
}: ProductMediaCarouselBlock) {
  if (!slides?.length) return null
  return (
    <div className={blockStyles.root} data-website-theme={theme ?? undefined}>
      <Entrance>
        <div className={styles.header}>
          <ProductBlockHeader title={title} eyebrow={eyebrow} />
        </div>
        <Carousel
          slides={slides}
          aspectRatio={aspectRatio}
          label={title || 'Product media carousel'}
        />
      </Entrance>
    </div>
  )
}
