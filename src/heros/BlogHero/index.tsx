import Link from 'next/link'
import type { Blog } from '@/payload-types'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import styles from './index.module.css'

export const BlogHero = ({ blog }: { blog: Blog }) => {
  const category =
    typeof blog.category === 'object' && blog.category !== null ? blog.category : null
  const authors = (blog.populatedAuthors ?? [])
    .map(({ name }) => name?.trim())
    .filter((name): name is string => Boolean(name))

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/blogs">Blogs</Link>
          </li>
          {category && (
            <>
              <li aria-hidden="true">/</li>
              <li className={styles.categoryCrumb}>
                <Link href={`/blogs/category/${category.slug}`}>{category.title}</Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page">{blog.title}</li>
        </ol>
      </nav>
      <header className={styles.header}>
        <h1>{blog.title}</h1>
        <div className={styles.meta}>
          {authors.length > 0 && (
            <span>
              By <strong>{authors.join(', ')}</strong>
            </span>
          )}
          {authors.length > 0 && blog.publishedAt && <span aria-hidden="true">·</span>}
          {blog.publishedAt && (
            <time dateTime={blog.publishedAt}>
              {new Intl.DateTimeFormat('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(blog.publishedAt))}
            </time>
          )}
        </div>
        <p className={styles.excerpt}>{blog.excerpt}</p>
      </header>
      {typeof blog.heroImage === 'object' && blog.heroImage !== null && (
        <div className={styles.media}>
          <Media
            resource={blog.heroImage}
            presentation={MEDIA_PRESENTATION.hero}
            priority
            size="(max-width: 76.25rem) 100vw, 76.25rem"
          />
        </div>
      )}
    </>
  )
}
