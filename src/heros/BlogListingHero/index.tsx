import React from 'react'

import { Media } from '@/components/Media'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import type { BlogListingHeroModel } from '@/utilities/blogs/getBlogListingHero'

import styles from './index.module.css'

export const BlogListingHero: React.FC<BlogListingHeroModel> = ({
  heading,
  description,
  image,
  headerTheme,
}) => (
  <section
    className={styles.root}
    data-hero="blog-listing"
    data-website-theme={headerTheme === 'dark' ? 'inverse' : undefined}
  >
    <HeaderThemeSync theme={headerTheme} />
    {image && typeof image === 'object' && (
      <div className={styles.mediaFrame} data-hero-media-frame aria-hidden="true">
        <Media
          fill
          priority
          size="100vw"
          resource={image}
          imgClassName={styles.image}
          presentation={{ image: { fit: 'cover', quality: 85 } }}
        />
        <div className={styles.scrim} data-hero-scrim />
      </div>
    )}
    <div className={styles.content}>
      <h1 className={styles.heading}>{heading}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </div>
  </section>
)
