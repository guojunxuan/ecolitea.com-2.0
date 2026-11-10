import { Children, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { OverflowTrack } from '../OverflowCarousel/Track'
import styles from './index.module.css'

export function ProductPreviewGrid({
  children,
  href,
  categoryTitle,
}: {
  children: ReactNode
  href: string
  categoryTitle: string
}) {
  const products = Children.toArray(children)
  if (!products.length) return null

  return (
    <div
      className={styles.root}
      data-product-preview
      data-product-layout="three"
      data-count={products.length}
    >
      <OverflowTrack
        title={`Latest Products · ${categoryTitle}`}
        variant="contained"
        controls="outer"
        className={styles.viewport}
        trackClassName={styles.track}
        draggable
      >
        <ul className={styles.grid}>
          {products.map((child, index) => (
            <li className={styles.item} key={index}>
              {child}
            </li>
          ))}
          <li className={`${styles.item} ${styles.moreItem}`}>
            <Link
              href={href}
              className={styles.moreCard}
              aria-label={`View More · ${categoryTitle}`}
              data-product-view-more
            >
              <span className={styles.moreIcon} aria-hidden="true">
                <ChevronRight />
              </span>
              <span className={`website-type-title ${styles.moreLabel}`}>View More</span>
            </Link>
          </li>
        </ul>
      </OverflowTrack>
    </div>
  )
}
