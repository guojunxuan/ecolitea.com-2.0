import React from 'react'

import { CategoryLinks } from './CategoryLinks'
import { MobileCategoryMenu } from './MobileCategoryMenu'
import styles from './index.module.css'

export type BlogCategoryTab = {
  id: string
  title: string
  slug: string
  count: number
}

export const BlogCategoryTabs: React.FC<{
  categories: BlogCategoryTab[]
  currentCategory?: string
}> = ({ categories, currentCategory }) => {
  const links = [
    { id: 'all', title: 'All', slug: null },
    ...categories.filter((category) => category.count > 0),
  ]

  return (
    <nav aria-label="Blog categories" className={styles.navigation}>
      <CategoryLinks links={links} currentCategory={currentCategory} />
      <MobileCategoryMenu links={links} currentCategory={currentCategory} />
    </nav>
  )
}
