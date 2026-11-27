'use client'

import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import type { Blog } from '@/payload-types'
import { cn } from '@/utilities/ui'
import Link from '@/components/LocaleLink'
import type React from 'react'

import styles from './index.module.css'

export type CardBlogData = Pick<Blog, 'slug' | 'title' | 'heroImage' | 'excerpt' | 'category' | 'publishedAt'>

type CardProps = {
  className?: string
  doc: CardBlogData
  relationTo: 'blogs'
  title?: string
}

export const Card: React.FC<CardProps> = ({ className, title: titleFromProps, doc }) => {
  const { category, excerpt, heroImage, publishedAt, slug, title } = doc
  const categoryDoc = typeof category === 'object' && category !== null ? category : null
  const publishedDate = publishedAt && !Number.isNaN(Date.parse(publishedAt))
    ? new Date(publishedAt)
    : null
  const href = `/blogs/${slug}`

  return (
    <article className={cn(styles.card, styles.blogCard, className)} data-slot="content-card">
      <div className={styles.blogMedia} data-slot="content-card-media">
        {typeof heroImage === 'object' && heroImage !== null ? (
          <Media presentation={MEDIA_PRESENTATION.card} resource={heroImage} size="(max-width: 48rem) 100vw, (max-width: 64rem) 50vw, 33vw" />
        ) : (
          <div className={styles.mediaPlaceholder}>No image</div>
        )}
      </div>
      <div className={styles.blogBody} data-slot="content-card-body">
        {categoryDoc?.slug && (
          <Link className={styles.blogCategory} data-slot="content-card-category" href={`/blogs/category/${categoryDoc.slug}`}>
            {categoryDoc.title}
          </Link>
        )}
        <h3 className={styles.blogHeading} data-slot="content-card-title">
          {/* The title link stretches over the card so every card area uses native link behavior. */}
          <Link className={styles.blogLink} data-slot="content-card-link" href={href}>
            {titleFromProps || title}
          </Link>
        </h3>
        {excerpt && <p className={styles.blogExcerpt} data-slot="content-card-description">{excerpt.replace(/\s/g, ' ')}</p>}
        {publishedDate && (
          <time className={styles.blogDate} dateTime={publishedDate.toISOString().slice(0, 10)}>
            {publishedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          </time>
        )}
      </div>
    </article>
  )
}
