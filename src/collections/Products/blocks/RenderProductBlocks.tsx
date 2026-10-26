import React, { Fragment } from 'react'
import type { Product } from '@/payload-types'
import { Component as Banner } from './MediaBanner/Component'
import { Component as Carousel } from './MediaCarousel/Component'
import { Component as Tabs } from './MediaTabs/Component'
import { Component as Accordion } from './MediaAccordion/Component'
import { Component as MediaText } from './MediaText/Component'
import { Component as Code } from './Code/Component'

export type ProductBlock = NonNullable<NonNullable<Product['sections']>[number]['blocks']>[number]
export function RenderProductBlocks({ blocks }: { blocks?: ProductBlock[] | null }) {
  if (!blocks?.length) return null
  return (
    <Fragment>
      {blocks.map((block, index) => {
        const key = block.id || `${block.blockType}-${index}`
        switch (block.blockType) {
          case 'productMediaBanner':
            return <Banner key={key} {...block} />
          case 'productMediaCarousel':
            return <Carousel key={key} {...block} />
          case 'productMediaTabs':
            return <Tabs key={key} {...block} />
          case 'productMediaAccordion':
            return <Accordion key={key} {...block} />
          case 'productMediaText':
            return <MediaText key={key} {...block} />
          case 'productCode':
            return <Code key={key} {...block} />
          default:
            return null
        }
      })}
    </Fragment>
  )
}
