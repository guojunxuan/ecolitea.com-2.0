import React from 'react'
import type { ProductMediaAccordionBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import RichText from '@/components/RichText'
import { Entrance } from '../shared/Entrance'
import { Accordion } from './Accordion'
import styles from './Component.module.css'

export function Component({
  title,
  items,
  aspectRatio,
  mediaPosition,
}: ProductMediaAccordionBlock) {
  if (!items?.length) return null
  return (
    <Entrance className={styles.container} blockType="productMediaAccordion">
      <ProductBlockHeader title={title} />
      <Accordion
        items={items.map(({ body, ...item }) => ({
          ...item,
          body: body ? <RichText data={body} enableGutter={false} /> : null,
        }))}
        aspectRatio={aspectRatio}
        mediaPosition={mediaPosition}
      />
    </Entrance>
  )
}
