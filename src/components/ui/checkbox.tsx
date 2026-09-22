'use client'

import { cn } from '@/utilities/ui'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'

import styles from './checkbox.module.css'

const Checkbox: React.FC<React.ComponentProps<typeof CheckboxPrimitive.Root>> = ({
  className,
  ...props
}) => (
  <CheckboxPrimitive.Root
    data-slot="checkbox"
    className={cn(styles.checkbox, className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className={styles.indicator}>
      <Check className={styles.checkIcon} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)

export { Checkbox }
