import React from 'react'
import type { ProductCodeBlock } from '@/payload-types'
import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'
import { Entrance } from '../shared/Entrance'
import { CodeFrame } from './CodeFrame'
import { buildProductCodeDocument } from './document'
import styles from './Component.module.css'

export function Component(block: ProductCodeBlock) {
  return (
    <Entrance blockType="productCode">
      <div className={styles.block} data-width={block.width}>
        <ProductBlockHeader title={block.title} />
        <CodeFrame
          title={block.label}
          srcDoc={buildProductCodeDocument(block)}
          minHeight={block.minHeight}
        />
      </div>
    </Entrance>
  )
}
