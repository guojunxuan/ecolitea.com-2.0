import type { BannerBlock as BannerBlockProps } from '@/payload-types'

import { cn } from '@/utilities/ui'
import React from 'react'
import RichText from '@/components/RichText'
import styles from './Component.module.css'

type Props = {
  className?: string
} & BannerBlockProps

const statusClasses: Record<NonNullable<BannerBlockProps['style']>, string> = {
  info: styles.info,
  warning: styles.warning,
  error: styles.error,
  success: styles.success,
}

const statusLabels: Record<NonNullable<BannerBlockProps['style']>, string> = {
  info: 'Information',
  warning: 'Warning',
  error: 'Error',
  success: 'Success',
}

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  const status = style && statusClasses[style] ? style : undefined

  return (
    <div className={cn(styles.banner, className)}>
      <div
        className={cn(styles.surface, status && statusClasses[status])}
        role={status ? 'note' : undefined}
      >
        {status && <span className={styles.statusLabel}>{statusLabels[status]}</span>}
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
