import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'

import type { ContentBlock as ContentBlockProps } from '@/payload-types'

import { CMSLink } from '../../components/Link'
import styles from './Component.module.css'

type ColumnSize = NonNullable<NonNullable<ContentBlockProps['columns']>[number]['size']>

const columnClasses: Record<ColumnSize, string> = {
  full: styles.full,
  half: styles.half,
  oneThird: styles.oneThird,
  twoThirds: styles.twoThirds,
}

export const ContentBlock: React.FC<ContentBlockProps> = (props) => {
  const { columns } = props

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {columns &&
          columns.length > 0 &&
          columns.map((col, index) => {
            const { enableLink, link, richText, size } = col

            return (
              <div
                className={cn(styles.column, size && columnClasses[size], {
                  [styles.partial]: size !== 'full',
                })}
                key={index}
              >
                {richText && <RichText data={richText} enableGutter={false} />}

                {enableLink && <CMSLink {...link} />}
              </div>
            )
          })}
      </div>
    </div>
  )
}
