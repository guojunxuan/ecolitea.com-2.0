import Link from 'next/link'
import React from 'react'

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
  const populatedCategories = categories.filter((category) => category.count > 0)
  const total = populatedCategories.reduce((sum, category) => sum + category.count, 0)
  const links = [
    { id: 'all', title: 'All', slug: null, count: total },
    ...populatedCategories,
  ]
  const firstMobileLinks = links.slice(0, 3)
  const selectedCategory = populatedCategories.find((category) => category.slug === currentCategory)
  const mobileLinks =
    selectedCategory && !firstMobileLinks.some((category) => category.slug === currentCategory)
      ? [...firstMobileLinks.slice(0, 2), selectedCategory]
      : firstMobileLinks
  const moreLinks = links.filter(
    (category) => !mobileLinks.some((visibleCategory) => visibleCategory.slug === category.slug),
  )

  return (
    <nav aria-label="Blog categories" className={styles.navigation}>
      <div className={styles.tabs}>
        {links.map((category) => {
          const isActive = category.slug === (currentCategory || null)
          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={styles.tab}
              href={category.slug ? `/blogs/category/${category.slug}` : '/blogs'}
              key={category.id}
            >
              {category.title} <span className={styles.count}>{category.count}</span>
            </Link>
          )
        })}
      </div>
      <div className={styles.mobileTabs} data-slot="blog-mobile-tabs">
        {mobileLinks.map((category) => (
          <Link
            aria-current={category.slug === (currentCategory || null) ? 'page' : undefined}
            className={styles.tab}
            href={category.slug ? `/blogs/category/${category.slug}` : '/blogs'}
            key={category.id}
          >
            {category.title} <span className={styles.count}>{category.count}</span>
          </Link>
        ))}
        {moreLinks.length > 0 && (
          <details className={styles.more}>
            <summary>More categories</summary>
            <div className={styles.moreLinks}>
              {moreLinks.map((category) => (
                <Link
                  aria-current={category.slug === currentCategory ? 'page' : undefined}
                  className={styles.tab}
                  href={`/blogs/category/${category.slug}`}
                  key={category.id}
                >
                  {category.title} <span className={styles.count}>{category.count}</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>
    </nav>
  )
}
