import * as React from 'react'
import { cn } from '@/utilities/ui'
import styles from './index.module.css'

export const Width: React.FC<{
  children: React.ReactNode
  className?: string
  width?: number | string
}> = ({ children, className, width }) => {
  return (
    <div
      className={cn(styles.width, className)}
      style={{ '--form-field-width': width ? `${width}%` : undefined } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
