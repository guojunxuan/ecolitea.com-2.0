import styles from './index.module.css'

export const SegmentIndicator = ({
  count,
  active,
  progress,
  onSelect,
  paused,
}: {
  count: number
  active: number
  progress?: number
  onSelect?: (index: number) => void
  paused?: boolean
}) => {
  if (count < 2) return null
  const current = Math.max(0, Math.min(count - 1, active))
  const fraction = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress!)) : 0
  const segment = (index: number) => (
    <span
      className={styles.fill}
      data-progress={index === current || undefined}
      style={
        progress !== undefined
          ? { transform: `scaleX(${index === current ? fraction : 0})` }
          : undefined
      }
    />
  )
  return (
    <div
      className={styles.indicator}
      aria-hidden={onSelect ? undefined : true}
      data-paused={paused || undefined}
    >
      {Array.from({ length: count }, (_, index) =>
        onSelect ? (
          <button
            key={index}
            type="button"
            className={styles.segment}
            data-active={index === current || undefined}
            aria-current={index === current || undefined}
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => onSelect(index)}
          >
            {segment(index)}
          </button>
        ) : (
          <span key={index} className={styles.segment} data-active={index === current || undefined}>
            {segment(index)}
          </span>
        ),
      )}
    </div>
  )
}
