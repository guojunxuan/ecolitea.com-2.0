import { cn } from '@/utilities/ui'
import * as React from 'react'

import styles from './card.module.css'

const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div data-slot="card" className={cn(styles.card, className)} {...props} />
}

const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div data-slot="card-header" className={cn(styles.header, className)} {...props} />
}

const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => {
  return <h3 data-slot="card-title" className={cn(styles.title, className)} {...props} />
}

const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => {
  return <p data-slot="card-description" className={cn(styles.description, className)} {...props} />
}

const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div data-slot="card-content" className={cn(styles.content, className)} {...props} />
}

const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return <div data-slot="card-footer" className={cn(styles.footer, className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
