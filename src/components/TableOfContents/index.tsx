import type { TOCItem } from '@/utilities/blogs/extractTOC'
import styles from './index.module.css'

const Links = ({ items }: { items: TOCItem[] }) => (
  <ol className={styles.list}>
    {items.map((item) => (
      <li className={item.level === 3 ? styles.nested : undefined} key={item.id}>
        <a href={`#${item.id}`}>{item.text}</a>
      </li>
    ))}
  </ol>
)

export const TableOfContents = ({ items }: { items: TOCItem[] }) => {
  if (!items.length) return null

  return (
    <aside className={styles.wrapper}>
      <nav aria-label="Table of contents" className={styles.desktop}>
        <p className={styles.label}>On this page</p>
        <Links items={items} />
      </nav>
      <details className={styles.mobile}>
        <summary>On this page</summary>
        <nav aria-label="Table of contents">
          <Links items={items} />
        </nav>
      </details>
    </aside>
  )
}
