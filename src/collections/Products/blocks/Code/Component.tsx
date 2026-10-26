import React from 'react'
import type { ProductCodeBlock } from '@/payload-types'
import { CodeFrame } from './CodeFrame'
import { buildProductCodeDocument } from './document'
import styles from './Component.module.css'

export function Component(block: ProductCodeBlock) {
  return (
    <div
      className={styles.block}
      data-width={block.width}
      data-website-theme={block.theme ?? undefined}
    >
      <CodeFrame
        title={block.label}
        srcDoc={buildProductCodeDocument(block)}
        minHeight={block.minHeight}
      />
    </div>
  )
}
