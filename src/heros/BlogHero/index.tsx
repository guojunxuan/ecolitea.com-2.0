import Link from 'next/link'
import type { Blog } from '@/payload-types'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getServerSideURL } from '@/utilities/getURL'
import styles from './index.module.css'

export const BlogHero = ({ blog }: { blog: Blog }) => {
  const category = typeof blog.category === 'object' && blog.category !== null ? blog.category : null
  const authors = (blog.populatedAuthors ?? []).map(({ name }) => name?.trim()).filter((name): name is string => Boolean(name))
  const initials = authors[0]?.split(/\s+/u).map((part) => part[0]).slice(0, 2).join('').toLocaleUpperCase()
  const url = new URL(`/blogs/${encodeURIComponent(blog.slug)}`, getServerSideURL()).toString()
  const shareURL = encodeURIComponent(url)
  const shareTitle = encodeURIComponent(blog.title)

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>
          <li><Link href="/">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/blogs">Blogs</Link></li>
          {category && <><li aria-hidden="true">/</li><li><Link href={`/blogs/category/${category.slug}`}>{category.title}</Link></li></>}
          <li aria-hidden="true">/</li>
          <li aria-current="page">{blog.title}</li>
        </ol>
      </nav>
      <header className={styles.header}>
        {category && <Link className={styles.category} href={`/blogs/category/${category.slug}`}>{category.title}</Link>}
        <h1>{blog.title}</h1>
        <div className={styles.meta}>
          {authors.length > 0 && <div className={styles.authors}>
            <span aria-label={authors[0]} className={styles.initials}>{initials}</span>
            <span>{authors.join(', ')}</span>
          </div>}
          {blog.publishedAt && <time dateTime={blog.publishedAt}>{formatDateTime(blog.publishedAt)}</time>}
          <div className={styles.share} aria-label="Share article">
            <a aria-label="Share on X" href={`https://twitter.com/intent/tweet?url=${shareURL}&text=${shareTitle}`} rel="noopener noreferrer" target="_blank">X</a>
            <a aria-label="Share on Facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${shareURL}`} rel="noopener noreferrer" target="_blank">f</a>
            <a aria-label="Share on LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareURL}`} rel="noopener noreferrer" target="_blank">in</a>
          </div>
        </div>
      </header>
      {typeof blog.heroImage === 'object' && blog.heroImage !== null && <div className={styles.media}>
        <Media resource={blog.heroImage} presentation={MEDIA_PRESENTATION.hero} priority size="(max-width: 80rem) 100vw, 80rem" />
      </div>}
    </>
  )
}
