import React from 'react'
import type { ProductMediaBannerBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { Entrance } from '../shared/Entrance'
import { BannerMedia } from './BannerMedia'
import styles from './Component.module.css'

export function Component({
  title,
  body,
  media,
  mobileMedia,
  playback,
  aspectRatio,
}: ProductMediaBannerBlock) {
  return (
    <Entrance blockType="productMediaBanner">
      <div className={styles.banner} data-ratio={aspectRatio}>
        <BannerMedia
          media={media}
          mobileMedia={mobileMedia}
          playback={playback}
          aspectRatio={aspectRatio}
          title={title}
        />
        <div className={styles.copy}>
          <ProductBlockHeader title={title} />
          {body && <p className="website-type-body-md">{body}</p>}
        </div>
      </div>
    </Entrance>
  )
}
