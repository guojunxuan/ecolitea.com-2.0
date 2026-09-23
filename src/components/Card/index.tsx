'use client'
import { cn } from '@/utilities/ui'
import useClickableCard from '@/utilities/useClickableCard'
import Link from 'next/link'
import React, { Fragment } from 'react'

import type { Post } from '@/payload-types'

import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'

import styles from './index.module.css'

export type CardPostData = Pick<Post, 'slug' | 'categories' | 'meta' | 'title'>

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  doc?: CardPostData
  relationTo?: 'posts'
  showCategories?: boolean
  title?: string
}> = (props) => {
  const { cardRef, linkRef } = useClickableCard({})
  const { className, doc, relationTo, showCategories, title: titleFromProps } = props

  const { slug, categories, meta, title } = doc || {}
  const { description, image: metaImage } = meta || {}

  const hasCategories = categories && Array.isArray(categories) && categories.length > 0
  const titleToUse = titleFromProps || title
  const sanitizedDescription = description?.replace(/\s/g, ' ') // replace non-breaking space with white space
  const href = `/${relationTo}/${slug}`

  return (
    <article className={cn(styles.card, className)} data-slot="content-card" ref={cardRef}>
      <div className={styles.media} data-slot="content-card-media">
        {!metaImage && <div>No image</div>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media presentation={MEDIA_PRESENTATION.card} resource={metaImage} size="33vw" />
        )}
      </div>
      <div className={styles.body} data-slot="content-card-body">
        {showCategories && hasCategories && (
          <div className={styles.categoryLabel} data-slot="content-card-category">
            {categories?.map((category, index) => {
              if (typeof category === 'object') {
                const { title: titleFromCategory } = category

                const categoryTitle = titleFromCategory || 'Untitled category'

                const isLast = index === categories.length - 1

                return (
                  <Fragment key={index}>
                    {categoryTitle}
                    {!isLast && <Fragment>, &nbsp;</Fragment>}
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
