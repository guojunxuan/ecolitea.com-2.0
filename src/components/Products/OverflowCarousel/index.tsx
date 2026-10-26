import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Children, type ReactNode } from 'react'

import { ProductBlockHeader } from '@/components/Products/ProductBlockHeader'

import { OverflowTrack } from './Track'
import styles from './index.module.css'

export const OverflowCarousel = ({
  title,
  eyebrow,
  href,
  linkLabel,
  children,
}: {
  title: string
  eyebrow?: string
  href?: string
  linkLabel?: string
  children: ReactNode
}) => (
  <div className={styles.carousel}>
    <div className={styles.header}>
      <ProductBlockHeader eyebrow={eyebrow} title={title} />
      {href && linkLabel && (
        <Link href={href} className={styles.link}>
          {linkLabel}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      )}
    </div>
    <OverflowTrack title={title}>
      {Children.map(children, (child) => child && <div className={styles.item}>{child}</div>)}
    </OverflowTrack>
  </div>
)
