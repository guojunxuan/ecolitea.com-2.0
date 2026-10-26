import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Media } from '@/components/Media'
import type { ProductCategoryModel } from '@/utilities/products/models'

import styles from './index.module.css'

type Category = Pick<ProductCategoryModel, 'title' | 'slug' | 'image'>

export const CategoryCard = ({ category }: { category: Category }) => (
  <Link href={`/products/${category.slug}`} className={styles.card} data-product-category-card>
    <div className={styles.cover}>
      {category.image && (
        <Media
          resource={category.image}
          fill
          imgClassName={styles.image}
          presentation={{ image: { fit: 'cover', aspectRatio: { width: 4, height: 3 } } }}
          size="(max-width: 767px) 72vw, 33vw"
        />
      )}
    </div>
    <div className={styles.caption}>
      <h3 className={styles.title}>{category.title}</h3>
      <ArrowRight aria-hidden="true" className={styles.arrow} size={20} />
    </div>
  </Link>
)
