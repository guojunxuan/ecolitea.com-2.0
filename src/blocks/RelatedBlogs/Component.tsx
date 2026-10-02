import Link from 'next/link'
import { Media } from '@/components/Media'
import { MEDIA_PRESENTATION } from '@/components/Media/config'
import type { BlogListItem } from '@/utilities/blogs/getBlogListing'
import styles from './Component.module.css'

export const RelatedBlogs = ({ blogs }: { blogs: BlogListItem[] }) => {
  if (!blogs.length) return null

  return <section aria-label="More to read" className={styles.root}>
    <h2>More to read</h2>
    <div className={styles.grid}>
      {blogs.slice(0, 3).map((blog) => {
        const category = typeof blog.category === 'object' && blog.category !== null ? blog.category : null
        return <article className={styles.card} key={blog.id}>
          <Link aria-label={`Read ${blog.title}`} className={styles.media} href={`/blogs/${blog.slug}`}>
            {typeof blog.heroImage === 'object' && blog.heroImage !== null && <Media resource={blog.heroImage} presentation={MEDIA_PRESENTATION.card} size="(max-width: 48rem) 100vw, 33vw" />}
          </Link>
          <div className={styles.body}>
            {category && <Link className={styles.category} href={`/blogs/category/${category.slug}`}>{category.title}</Link>}
            <h3><Link href={`/blogs/${blog.slug}`}>{blog.title}</Link></h3>
            {blog.excerpt && <p>{blog.excerpt}</p>}
          </div>
        </article>
      })}
    </div>
  </section>
}
