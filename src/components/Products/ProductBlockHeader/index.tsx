import styles from './index.module.css'

export const ProductBlockHeader = ({
  eyebrow,
  title,
  headingLevel = 3,
  alignment = 'center',
}: {
  eyebrow?: string | null
  title?: string | null
  headingLevel?: 2 | 3
  alignment?: 'left' | 'center'
}) => {
  if (!eyebrow && !title) return null
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className={styles.header} data-alignment={alignment}>
      {eyebrow && <p className={`website-type-eyebrow ${styles.eyebrow}`}>{eyebrow}</p>}
      {title && <Heading className={styles.title}>{title}</Heading>}
    </div>
  )
}
