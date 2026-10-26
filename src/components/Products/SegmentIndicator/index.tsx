import styles from './index.module.css'

export const SegmentIndicator = ({ count, active }: { count: number; active: number }) => {
  if (count < 2) return null
  const current = Math.max(0, Math.min(count - 1, active))
  return (
    <div className={styles.indicator} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className={styles.segment} data-active={index === current || undefined} />
      ))}
    </div>
  )
}
