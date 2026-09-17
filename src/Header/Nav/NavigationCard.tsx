import React from 'react'

import { Media } from '@/components/Media'

import type { HeaderCardData } from './types'
import styles from './blocks.module.css'
import { NavigationLink } from './NavigationLink'

export type NavigationCardVariant = 'product' | 'visual' | 'rich'

type NavigationCardProps = {
  card: HeaderCardData
  description?: string | null
  mode?: 'compact' | 'desktop'
  size?: string
  variant?: NavigationCardVariant
}

const cardSize = (variant: NavigationCardVariant, mode: 'compact' | 'desktop') => {
  if (variant === 'rich') return '(max-width: 1170px) 100vw, 50vw'
  if (mode === 'compact') {
    return '(max-width: 360px) 100vw, (max-width: 1170px) 50vw, 25vw'
  }
  return '25vw'
}

export const NavigationCard: React.FC<NavigationCardProps> = ({
  card,
  description,
  mode = 'desktop',
  size,
  variant = 'product',
}) => {
  const imagePresentation =
    variant === 'visual'
      ? { image: { aspectRatio: { width: 16, height: 9 }, fit: 'cover' as const } }
      : variant === 'rich'
        ? { image: { aspectRatio: { width: 16, height: 9 }, fit: 'contain' as const } }
        : { image: { aspectRatio: { width: 4, height: 3 }, fit: 'contain' as const } }

  return (
    <NavigationLink
      className={`${styles.navigationCard} ${styles[`navigationCard${variant[0].toUpperCase()}${variant.slice(1)}`]}`}
      link={card.link}
    >
      <span className={styles.navigationCardImage}>
        <Media
          alt=""
          htmlElement={null}
          presentation={imagePresentation}
          resource={card.image}
          size={size ?? cardSize(variant, mode)}
        />
        {variant === 'visual' && <span aria-hidden="true" className={styles.navigationCardGradient} />}
      </span>
      <span className={styles.navigationCardBody}>
        <span className={styles.navigationCardTitle}>{card.title}</span>
        {variant !== 'product' && description ? <span className={styles.navigationCardDescription}>{description}</span> : null}
      </span>
    </NavigationLink>
  )
}
