'use client'

import React from 'react'
import { ProductMedia, type ProductMediaProps } from './ProductMedia'

/** Keep hidden media mounted for crossfades, but never leave hidden videos playing. */
export function ActiveMedia({ active, ...props }: ProductMediaProps & { active: boolean }) {
  return <ProductMedia {...props} active={active} />
}
