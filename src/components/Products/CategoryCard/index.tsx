import Link from '@/components/LocaleLink'

import { Media } from '@/components/Media'
import type { ProductCategoryModel } from '@/utilities/products/models'

import styles from './index.module.css'

type Category = Pick<ProductCategoryModel, 'title' | 'slug' | 'image'>

export const CategoryCard = ({ category }: { category: Category }) => (
  <Link href={`/products/${category.slug}`} className={styles.card} data-product-category-card>
    <div className={styles.cover} data-product-category-cover>
      {category.image && (
        <Media
          resource={category.image}
          fill
          imgClassName={styles.image}
          presentation={{ image: { fit: 'cover', aspectRatio: { width: 16, height: 9 } } }}
          size="(max-width: 767px) 72vw, 33vw"
        />
      )}
      <div className={styles.caption}>
        <h3 className={styles.title}>{category.title}</h3>
      </div>
    </div>
  </Link>
)
