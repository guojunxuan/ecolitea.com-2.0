import Link from 'next/link'

import { Media } from '@/components/Media'
import type { ProductCard as ProductCardModel } from '@/utilities/products/models'

import styles from './index.module.css'

export const ProductCard = ({ product }: { product: ProductCardModel }) => (
  <Link
    className={styles.card}
    data-product-card
    href={`/products/${product.categorySlug}/${product.slug}`}
  >
    <div className={`${styles.cover} ${!product.cover ? styles.placeholder : ''}`}>
      {product.cover && (
        <Media
          resource={product.cover}
          fill
          imgClassName={styles.image}
          presentation={{ image: { fit: 'contain', aspectRatio: { width: 1, height: 1 } } }}
          size="(max-width: 767px) 72vw, 33vw"
        />
      )}
    </div>
    <div className={styles.content}>
      <h3 className={styles.title}>{product.title}</h3>
      {product.summary && <p className={styles.summary}>{product.summary}</p>}
    </div>
  </Link>
)
