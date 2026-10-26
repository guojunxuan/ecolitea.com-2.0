import React from 'react'
import type { ProductMediaTextBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import RichText from '@/components/RichText'
import { ProductMedia } from '../shared/ProductMedia'
import { Entrance } from '../shared/Entrance'
import blockStyles from '../shared/Block.module.css'
import styles from './Component.module.css'

export function Component({
  title,
  eyebrow,
  body,
  media,
  playback,
  aspectRatio,
  mediaPosition,
  theme,
}: ProductMediaTextBlock) {
  return (
    <div className={blockStyles.root} data-website-theme={theme ?? undefined}>
      <Entrance className={styles.layout}>
        <div className={styles.copy}>
          <ProductBlockHeader title={title} eyebrow={eyebrow} />
          {body && <RichText data={body} enableGutter={false} />}
        </div>
        <div className={styles.visual} data-position={mediaPosition}>
          <ProductMedia resource={media} playback={playback} aspectRatio={aspectRatio} />
        </div>
      </Entrance>
    </div>
  )
}
