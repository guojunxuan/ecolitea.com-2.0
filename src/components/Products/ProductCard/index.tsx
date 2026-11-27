import Link from '@/components/LocaleLink'

import { Media } from '@/components/Media'
import { Button } from '@/components/ui/button'
import type { ProductCard as ProductCardModel } from '@/utilities/products/models'

import styles from './index.module.css'

export const ProductCard = ({
  product,
  showAction = false,
}: {
  product: ProductCardModel
  showAction?: boolean
}) => (
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
          presentation={{ image: { fit: 'contain', aspectRatio: { width: 5, height: 4 } } }}
          size="(max-width: 1023px) 50vw, 33vw"
        />
      )}
    </div>
    <div className={styles.content}>
      <h3 className={styles.title}>{product.title}</h3>
      {product.summary && <p className={styles.summary}>{product.summary}</p>}
      {showAction && (
        <div className={styles.actions}>
          <Button asChild className={styles.action}>
            <span data-product-card-action>View More</span>
          </Button>
        </div>
      )}
    </div>
  </Link>
)
