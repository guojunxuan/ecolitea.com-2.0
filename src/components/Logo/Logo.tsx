import clsx from 'clsx'
import React from 'react'

import type { LogoImage } from './types'
import styles from './Logo.module.css'

interface Props {
  image: LogoImage | null
  className?: string
}

export const Logo = (props: Props) => {
  const { image, className } = props

  if (!image) return null

  return (
    <span
      aria-label={image.alt}
      role="img"
      className={clsx(styles.logo, className)}
      data-slot="logo"
      style={
        {
          '--logo-url': `url("${image.src}")`,
          '--logo-aspect-ratio': `${image.width} / ${image.height}`,
        } as React.CSSProperties
      }
    />
  )
}
