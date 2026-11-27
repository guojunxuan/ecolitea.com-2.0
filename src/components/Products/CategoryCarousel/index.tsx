import Link from '@/components/LocaleLink'

import { Media } from '@/components/Media'
import { OverflowTrack } from '@/components/Products/OverflowCarousel/Track'
import type { CategoryCarouselItem } from '@/utilities/products/getProductCategoryCarousel'

import styles from './index.module.css'

export const CategoryCarousel = ({ items, id }: { items: CategoryCarouselItem[]; id?: string }) => {
  if (!items.length) return null
  return (
    <nav id={id} className={styles.root} aria-label="Product categories">
      <div className={styles.container}>
        <OverflowTrack title="Product categories" variant="contained" draggable>
          {items.map((item) => (
            <Link key={item.id} href={item.href} className={styles.card}>
              <span
                className={styles.image}
                data-image-fit={item.imageFit}
                style={
                  {
                    '--category-focal-point': `${item.image?.focalX ?? 50}% ${item.image?.focalY ?? 50}%`,
                  } as React.CSSProperties
                }
              >
                {item.image && (
                  <Media
                    fill
                    size="9rem"
                    resource={item.image}
                    imgClassName={styles.img}
                    presentation={{ image: { fit: item.imageFit } }}
                  />
                )}
              </span>
              <span className={styles.title}>{item.title}</span>
            </Link>
          ))}
        </OverflowTrack>
      </div>
    </nav>
  )
}
