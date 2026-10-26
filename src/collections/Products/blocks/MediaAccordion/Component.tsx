import React from 'react'
import type { ProductMediaAccordionBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import RichText from '@/components/RichText'
import { Entrance } from '../shared/Entrance'
import blockStyles from '../shared/Block.module.css'
import { Accordion } from './Accordion'
import styles from './Component.module.css'

export function Component({
  theme,
  eyebrow,
  title,
  items,
  defaultMedia,
  aspectRatio,
  mediaPosition,
}: ProductMediaAccordionBlock) {
  if (!items?.length) return null
  return (
    <div className={blockStyles.root} data-website-theme={theme ?? undefined}>
      <Entrance>
        <Accordion
          items={items.map(({ body, ...item }) => ({
            ...item,
            body: body ? <RichText data={body} enableGutter={false} /> : null,
          }))}
          defaultMedia={defaultMedia}
          aspectRatio={aspectRatio}
          mediaPosition={mediaPosition}
          header={
            <div className={styles.header}>
              <ProductBlockHeader title={title} eyebrow={eyebrow} />
            </div>
          }
        />
      </Entrance>
    </div>
  )
}
