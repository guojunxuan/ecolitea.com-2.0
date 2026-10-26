import type { CSSProperties, ReactNode } from 'react'

import { Media } from '@/components/Media'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import type { ProductCategoryModel } from '@/utilities/products/models'

import styles from './index.module.css'

type Category = Pick<ProductCategoryModel, 'title' | 'description' | 'image'>

export const CategoryBand = ({
  category,
  headingLevel: Heading,
  breadcrumb,
  actions,
}: {
  category: Category
  headingLevel: 'h1' | 'h2'
  breadcrumb?: ReactNode
  actions: ReactNode
}) => (
  <div
    className={styles.band}
    data-website-theme="inverse"
    style={
      {
        '--product-image-position': `${category.image?.focalX ?? 50}% ${category.image?.focalY ?? 50}%`,
      } as CSSProperties
    }
  >
    {Heading === 'h1' && <HeaderThemeSync theme="dark" />}
    {category.image && (
      <Media
        className={styles.media}
        resource={category.image}
        fill
        imgClassName={styles.image}
        presentation={{ image: { fit: 'cover' } }}
        size="100vw"
      />
    )}
    <div className={styles.scrim} />
    <div className={styles.content}>
      {breadcrumb && <div className={styles.breadcrumb}>{breadcrumb}</div>}
      <Heading className={styles.title}>{category.title}</Heading>
      {category.description && <p className={styles.description}>{category.description}</p>}
      {actions && (
        <div className={styles.actions} data-product-band-actions>
          {actions}
        </div>
      )}
    </div>
  </div>
)
