import React from 'react'

import { Card, type CardBlogData, type CardPostData } from '@/components/Card'

import styles from './index.module.css'

export type Props =
  | { posts: CardPostData[]; relationTo?: 'posts'; featuredFirst?: false }
  | { posts: CardBlogData[]; relationTo: 'blogs'; featuredFirst?: boolean }

export const CollectionArchive: React.FC<Props> = (props) => {
  const { posts } = props
  const isBlog = props.relationTo === 'blogs'

  return (
    <div className={styles.archive}>
      <div>
        <div className={isBlog ? styles.blogGrid : styles.grid}>
          {posts?.map((result, index) => {
            if (typeof result === 'object' && result !== null) {
              return (
                <div
                  className={isBlog ? styles.blogItem : styles.item}
                  data-featured={isBlog && props.featuredFirst && index === 0 ? 'true' : undefined}
                  data-slot="archive-item"
                  key={index}
                >
                  {props.relationTo === 'blogs' ? (
                    <Card className={styles.card} doc={result as CardBlogData} relationTo="blogs" />
                  ) : (
                    <Card className={styles.card} doc={result as CardPostData} relationTo="posts" showCategories />
                  )}
                </div>
              )
            }

            return null
          })}
        </div>
      </div>
    </div>
  )
}
