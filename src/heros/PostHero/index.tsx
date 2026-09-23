import { formatDateTime } from '@/utilities/formatDateTime'
import React from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import { formatAuthors } from '@/utilities/formatAuthors'

import styles from './index.module.css'

export const PostHero: React.FC<{
  post: Post
}> = ({ post }) => {
  const { categories, heroImage, populatedAuthors, publishedAt, title } = post

  const hasAuthors =
    populatedAuthors && populatedAuthors.length > 0 && formatAuthors(populatedAuthors) !== ''

  return (
    <div className={styles.root} data-hero="post" data-website-theme="inverse">
      <div className={styles.content}>
        <div className={styles.body}>
          <div className={styles.categories}>
            {categories?.map((category, index) => {
              if (typeof category === 'object' && category !== null) {
                const { title: categoryTitle } = category

                const titleToUse = categoryTitle || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <React.Fragment key={index}>
                    {titleToUse}
                    {!isLast && <React.Fragment>, &nbsp;</React.Fragment>}
                  </React.Fragment>
                )
              }
              return null
            })}
          </div>

          <div>
            <h1 className={styles.title}>{title}</h1>
          </div>

          <div className={styles.meta}>
            {hasAuthors && (
              <div className={styles.author}>
                <div className={styles.metaItem}>
                  <p className={styles.metaLabel}>Author</p>

                  <p>{formatAuthors(populatedAuthors)}</p>
                </div>
              </div>
            )}
            {publishedAt && (
              <div className={styles.metaItem}>
                <p className={styles.metaLabel}>Date Published</p>

                <time dateTime={publishedAt}>{formatDateTime(publishedAt)}</time>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.mediaFrame}>
        {heroImage && typeof heroImage !== 'string' && (
          <Media
            fill
            priority
            imgClassName={styles.image}
            presentation={MEDIA_PRESENTATION.hero}
            resource={heroImage}
          />
        )}
        <div className={styles.overlay} />
      </div>
    </div>
  )
}
