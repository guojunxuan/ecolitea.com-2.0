import styles from './index.module.css'

export const ProductBlockHeader = ({
  eyebrow,
  title,
}: {
  eyebrow?: string | null
  title?: string | null
}) => {
  if (!eyebrow && !title) return null
  return (
    <div className={styles.header}>
      {eyebrow && <p className={`website-type-eyebrow ${styles.eyebrow}`}>{eyebrow}</p>}
      {title && <h2 className={styles.title}>{title}</h2>}
    </div>
  )
}
