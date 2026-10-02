'use client'

import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import type { Blog, Post } from '@/payload-types'
import useClickableCard from '@/utilities/useClickableCard'
import { cn } from '@/utilities/ui'
import Link from 'next/link'
import React, { Fragment } from 'react'

import styles from './index.module.css'

export type CardPostData = Pick<Post, 'slug' | 'categories' | 'meta' | 'title'>
export type CardBlogData = Pick<Blog, 'slug' | 'title' | 'heroImage' | 'excerpt' | 'category' | 'publishedAt'>

type CardProps = {
  alignItems?: 'center'
  className?: string
  showCategories?: boolean
  title?: string
} & (
  | { relationTo?: 'posts'; doc?: CardPostData }
  | { relationTo: 'blogs'; doc: CardBlogData }
)

export const Card: React.FC<CardProps> = (props) => {
  const { cardRef, linkRef } = useClickableCard<HTMLElement>({})
  const { className, title: titleFromProps } = props

  if (props.relationTo === 'blogs') {
    const { category, excerpt, heroImage, publishedAt, slug, title } = props.doc
    const categoryDoc = typeof category === 'object' && category !== null ? category : null
    const publishedDate = publishedAt && !Number.isNaN(Date.parse(publishedAt))
      ? new Date(publishedAt)
      : null
    const href = `/blogs/${slug}`

    return (
      <article className={cn(styles.card, styles.blogCard, className)} data-slot="content-card" ref={cardRef}>
        <div className={styles.blogMedia} data-slot="content-card-media">
          {typeof heroImage === 'object' && heroImage !== null ? (
            <Link aria-label={`Read ${title}`} className={styles.mediaLink} href={href}>
              <Media presentation={MEDIA_PRESENTATION.card} resource={heroImage} size="(max-width: 48rem) 100vw, 50vw" />
            </Link>
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
            <Link className={styles.link} data-slot="content-card-link" href={href} ref={linkRef}>
              {titleFromProps || title}
            </Link>
          </h3>
          {excerpt && <p className={styles.blogExcerpt} data-slot="content-card-description">{excerpt.replace(/\s/g, ' ')}</p>}
          <div className={styles.blogFooter}>
            {publishedDate && (
              <time dateTime={publishedDate.toISOString().slice(0, 10)}>
                {publishedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </time>
            )}
            <span aria-hidden="true" className={styles.blogArrow}>→</span>
          </div>
        </div>
      </article>
    )
  }

  const { slug, categories, meta, title } = props.doc || {}
  const { description, image: metaImage } = meta || {}
  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ')
  const href = `/posts/${slug}`

  return (
    <article className={cn(styles.card, className)} data-slot="content-card" ref={cardRef}>
      <div className={styles.media} data-slot="content-card-media">
        {!metaImage && <div>No image</div>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media presentation={MEDIA_PRESENTATION.card} resource={metaImage} size="33vw" />
        )}
      </div>
      <div className={styles.body} data-slot="content-card-body">
        {props.showCategories && hasCategories && (
          <div className={styles.categoryLabel} data-slot="content-card-category">
            {categories.map((category, index) => {
              if (typeof category === 'object') {
                const categoryTitle = category.title || 'Untitled category'
                return (
                  <Fragment key={index}>
                    {categoryTitle}
                    {index < categories.length - 1 && <Fragment>, &nbsp;</Fragment>}
                  </Fragment>
                )
              }
              return null
            })}
          </div>
        )}
        {titleToUse && (
          <div className={styles.title} data-slot="content-card-title">
            <h3 className={styles.heading}>
              <Link className={styles.link} data-slot="content-card-link" href={href} ref={linkRef}>
                {titleToUse}
              </Link>
            </h3>
          </div>
        )}
        {description && (
          <div className={styles.description} data-slot="content-card-description">
            <p>{sanitizedDescription}</p>
          </div>
        )}
      </div>
    </article>
  )
}
