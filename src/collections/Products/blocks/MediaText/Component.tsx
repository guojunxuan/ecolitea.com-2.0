import React from 'react'
import type { ProductMediaTextBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import RichText from '@/components/RichText'
import { ProductMedia } from '../shared/ProductMedia'
import { Entrance } from '../shared/Entrance'
import blockStyles from '../shared/Block.module.css'
import styles from './Component.module.css'
import splitStyles from '../shared/SplitMedia.module.css'

export function Component({
  title,
  body,
  media,
  playback,
  aspectRatio,
  mediaPosition,
}: ProductMediaTextBlock) {
  const containMedia =
    typeof media === 'object' &&
    media !== null &&
    ['image/png', 'image/webp', 'image/avif', 'image/gif'].includes(media.mimeType ?? '')
  return (
    <div className={blockStyles.root}>
      <Entrance blockType="productMediaText" className={styles.layout}>
        <div className={styles.copy}>
          <ProductBlockHeader title={title} alignment="left" />
          {body && (
            <div className={styles.body}>
              <RichText data={body} enableGutter={false} />
            </div>
          )}
        </div>
        <div className={styles.visual} data-position={mediaPosition}>
          <ProductMedia
            className={splitStyles.frame}
            resource={media}
            playback={playback}
            aspectRatio={aspectRatio}
            fit={containMedia ? 'contain' : 'cover'}
          />
        </div>
      </Entrance>
    </div>
  )
}
