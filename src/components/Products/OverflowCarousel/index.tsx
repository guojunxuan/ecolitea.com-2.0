import Link from '@/components/LocaleLink'
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
  variant = 'products',
}: {
  title: string
  eyebrow?: string
  href?: string
  linkLabel?: string
  children: ReactNode
  variant?: 'products' | 'categories'
}) => (
  <div className={`${styles.carousel} ${styles[variant]}`} data-product-carousel={variant}>
    <div className={styles.header}>
      <ProductBlockHeader eyebrow={eyebrow} title={title} headingLevel={2} alignment="left" />
      {href && linkLabel && (
        <Link href={href} className={styles.link}>
          {linkLabel}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 19"
            width="16"
            height="19"
            className={styles.linkChevron}
          >
            <path
              d="M10.5224 9.74237C10.5285 9.73077 10.5386 9.72104 10.5439 9.70907C10.6498 9.49501 10.6152 9.23305 10.4277 9.0609L6.17769 5.15357C6.06639 5.05124 5.91783 4.99608 5.7647 5.00022C5.61156 5.00436 5.46638 5.06746 5.36111 5.17565C5.25584 5.28383 5.19909 5.42823 5.20335 5.57709C5.20761 5.72595 5.27253 5.86706 5.38382 5.96939L9.19722 9.47592L5.39884 13.0345C5.28856 13.1378 5.22503 13.2795 5.22221 13.4283C5.2194 13.5772 5.27753 13.721 5.38382 13.8282C5.49012 13.9354 5.63587 13.9972 5.789 13.9999C5.94214 14.0026 6.09013 13.9461 6.2004 13.8428L10.4119 9.89731C10.42 9.88945 10.4231 9.87859 10.4311 9.87036C10.4373 9.86475 10.4438 9.86063 10.45 9.85464C10.4827 9.82134 10.5001 9.78055 10.5224 9.74237Z"
              fill="currentColor"
            />
          </svg>
        </Link>
      )}
    </div>
    <OverflowTrack title={title} controls="outer" draggable>
      {Children.map(children, (child) => child && <div className={styles.item}>{child}</div>)}
    </OverflowTrack>
  </div>
)
