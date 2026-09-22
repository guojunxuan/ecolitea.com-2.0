'use client'

import { cn } from '@/utilities/ui'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import styles from './button.module.css'

const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      default: styles.default,
      destructive: styles.destructive,
      outline: styles.outline,
      secondary: styles.secondary,
      ghost: styles.ghost,
      link: styles.link,
    },
    size: {
      clear: styles.clear,
      default: styles.sizeDefault,
      sm: styles.sizeSmall,
      lg: styles.sizeLarge,
      icon: styles.sizeIcon,
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

export interface ButtonProps
  extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button: React.FC<ButtonProps> = ({ asChild = false, className, size, variant, ...props }) => {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
