import type { PostBannerBlock as BannerBlockProps } from '@/payload-types'

import { cn } from '@/utilities/ui'
import React from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import RichText from '@/components/RichText'
import styles from './Component.module.css'

type Props = {
  className?: string
  id?: string | null
} & Omit<BannerBlockProps, 'id'>

const statusClasses: Record<NonNullable<BannerBlockProps['style']>, string> = {
  info: styles.info,
  warning: styles.warning,
  error: styles.error,
  success: styles.success,
}

const statusIcons = { info: Info, warning: TriangleAlert, error: CircleAlert, success: CircleCheck }

export const BannerBlock: React.FC<Props> = ({ className, content, style, title }) => {
  const status = style && statusClasses[style] ? style : undefined

  const Icon = status ? statusIcons[status] : Info

  return (
    <div className={cn(styles.banner, className)}>
      <div
        className={cn(styles.surface, status && statusClasses[status])}
        role="note"
        aria-label={title || status || 'Note'}
      >
        <Icon className={styles.icon} aria-hidden="true" size={20} />
        {title && <h2 className={styles.title}>{title}</h2>}
        <RichText data={content} enableGutter={false} enableProse={false} />
      </div>
    </div>
  )
}
