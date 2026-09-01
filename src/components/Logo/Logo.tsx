import clsx from 'clsx'
import React from 'react'

import type { LogoImage } from './types'

interface Props {
  image: LogoImage | null
  className?: string
  loading?: 'lazy' | 'eager'
  priority?: 'auto' | 'high' | 'low'
}

export const Logo = (props: Props) => {
  const { image, loading: loadingFromProps, priority: priorityFromProps, className } = props

  if (!image) return null

  const loading = loadingFromProps || 'lazy'
  const priority = priorityFromProps || 'low'

  return (
    /* eslint-disable @next/next/no-img-element */
    <img
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      loading={loading}
      fetchPriority={priority}
      decoding="async"
      className={clsx('block w-auto max-w-full', className)}
    />
  )
}
