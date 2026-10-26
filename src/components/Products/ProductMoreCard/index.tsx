import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Media } from '@/components/Media'
import type { Media as MediaModel } from '@/payload-types'

import styles from './index.module.css'

export const ProductMoreCard = ({
  href,
  remaining,
  categoryTitle,
  covers,
  productCount,
}: {
  href: string
  remaining: number
  categoryTitle: string
  covers: MediaModel[]
  productCount: number
}) => (
  <Link href={href} className={styles.card}>
    {covers.length > 0 && (
      <div className={styles.stack} aria-hidden="true">
        {covers.slice(0, 3).map((cover, index) => (
          <div className={styles.thumbnail} key={`${cover.id}-${index}`}>
            <Media
              resource={cover}
              alt=""
              fill
              imgClassName={styles.image}
              presentation={{ image: { fit: 'contain', aspectRatio: { width: 1, height: 1 } } }}
              size="56px"
            />
          </div>
        ))}
      </div>
    )}
    <span className={styles.count}>+{remaining}</span>
    <span className={styles.description}>more {categoryTitle}</span>
    <span className={styles.link}>
      View all {productCount}
      <ArrowRight aria-hidden="true" size={18} />
    </span>
  </Link>
)
