import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'

import type { HeaderCardData, HeaderLinkData } from './types'
import styles from './blocks.module.css'

export type NavigationCardVariant = 'product' | 'visual' | 'rich'

type NavigationCardProps = {
  card: HeaderCardData
  description?: string | null
  variant?: NavigationCardVariant
}

const cardSize = (variant: NavigationCardVariant) =>
  variant === 'visual'
    ? '(max-width: 360px) 100vw, (max-width: 767px) 50vw, (max-width: 1099px) 33vw, 25vw'
    : variant === 'rich'
      ? '(max-width: 1170px) 100vw, 50vw'
      : '(max-width: 767px) 50vw, (max-width: 1099px) 33vw, 25vw'

const linkProps = (link: HeaderLinkData) =>
  link.newTab ? { rel: 'noopener noreferrer', target: '_blank' as const } : {}

export const NavigationCard: React.FC<NavigationCardProps> = ({
  card,
  description,
  variant = 'product',
}) => {
  const imagePresentation =
    variant === 'visual'
      ? { image: { aspectRatio: { width: 16, height: 9 }, fit: 'cover' as const } }
      : { image: { aspectRatio: { width: 4, height: 3 }, fit: 'contain' as const } }

  return (
    <Link
      className={`${styles.navigationCard} ${styles[`navigationCard${variant[0].toUpperCase()}${variant.slice(1)}`]}`}
      href={card.link.href}
      {...linkProps(card.link)}
    >
      <span className={styles.navigationCardImage}>
        <Media
          alt=""
          htmlElement={null}
          presentation={imagePresentation}
          resource={card.image}
          size={cardSize(variant)}
        />
        {variant === 'visual' && <span aria-hidden="true" className={styles.navigationCardGradient} />}
      </span>
      <span className={styles.navigationCardBody}>
        <span className={styles.navigationCardTitle}>{card.title}</span>
        {description ? <span className={styles.navigationCardDescription}>{description}</span> : null}
        {variant === 'visual' && (
          <ArrowUpRight aria-hidden="true" className={styles.navigationCardArrow} size={18} />
        )}
      </span>
    </Link>
  )
}
