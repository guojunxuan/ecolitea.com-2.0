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

export const BannerBlock: React.FC<Props> = ({ className, content, style }) => {
  return (
    <div className={cn(styles.banner, className)}>
      <div className={cn(styles.surface, style && statusClasses[style])}>
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
