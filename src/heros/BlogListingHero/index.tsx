import React from 'react'

import { Media } from '@/components/Media'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import type { BlogListingHeroModel } from '@/utilities/blogs/getBlogListingHero'

import styles from './index.module.css'

type Props = BlogListingHeroModel & {
  /** Route navigation rendered above the heading, such as a category breadcrumb. */
  breadcrumb?: React.ReactNode
}

export const BlogListingHero: React.FC<Props> = ({
  heading,
  description,
  image,
  mobileMedia,
  headerTheme,
  breadcrumb,
}) => {
  const desktopMedia = image && typeof image === 'object' ? image : mobileMedia
  const mobileImage = mobileMedia ?? desktopMedia
  return (
    <section
      className={styles.root}
      data-hero="blog-listing"
      data-website-theme={headerTheme === 'dark' ? 'inverse' : undefined}
    >
      <HeaderThemeSync theme={headerTheme} />
      {desktopMedia && (
        <div
          className={styles.mediaFrame}
          data-hero-media-frame
          aria-hidden="true"
          style={
            {
              '--hero-focal-point': `${desktopMedia.focalX ?? 50}% ${desktopMedia.focalY ?? 50}%`,
              '--hero-mobile-focal-point': `${mobileImage?.focalX ?? 50}% ${mobileImage?.focalY ?? 50}%`,
            } as React.CSSProperties
          }
        >
          <Media
            fill
            priority
            size="100vw"
            resource={desktopMedia}
            mobileResource={mobileMedia}
            imgClassName={styles.image}
            presentation={{ image: { fit: 'cover', quality: 85 } }}
          />
          <div className={styles.scrim} data-hero-scrim />
        </div>
      )}
      <div className={styles.content}>
        {breadcrumb}
        <h1 className={styles.heading}>{heading}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
    </section>
  )
}
