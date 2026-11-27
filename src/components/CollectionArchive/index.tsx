import React from 'react'

import { Card, type CardBlogData } from '@/components/Card'

import styles from './index.module.css'

export type Props = { posts: CardBlogData[]; relationTo: 'blogs' }

export const CollectionArchive: React.FC<Props> = ({ posts, relationTo }) => (
  <div className={styles.archive}>
    <div className={styles.blogGrid}>
      {posts.map((blog) => (
        <div className={styles.blogItem} data-slot="archive-item" key={blog.slug}>
          <Card className={styles.card} doc={blog} relationTo={relationTo} />
        </div>
      ))}
    </div>
  </div>
)
