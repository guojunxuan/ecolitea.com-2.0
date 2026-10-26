import React from 'react'
import type { ProductMediaBannerBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { ProductMedia } from '../shared/ProductMedia'
import styles from './Component.module.css'

export function Component({
  title,
  body,
  media,
  playback,
  aspectRatio,
  theme,
}: ProductMediaBannerBlock) {
  return (
    <div className={styles.banner} data-website-theme={theme ?? undefined} data-ratio={aspectRatio}>
      <ProductMedia
        resource={media}
        playback={playback}
        aspectRatio={aspectRatio}
        className={styles.media}
      />
      <div className={styles.copy}>
        <ProductBlockHeader title={title} />
        {body && <p className="website-type-body-md">{body}</p>}
      </div>
    </div>
  )
}
