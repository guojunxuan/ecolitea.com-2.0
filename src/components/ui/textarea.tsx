import { cn } from '@/utilities/ui'
import * as React from 'react'

import styles from './textarea.module.css'

const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className,
  ...props
}) => {
  return <textarea data-slot="textarea" className={cn(styles.textarea, className)} {...props} />
}

export { Textarea }
