import type { WidgetServerProps } from 'payload'
import { getContentActivity } from './getContentActivity'
import styles from './Dashboard.module.css'

const weekday = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options })
const short = weekday({ weekday: 'short' })
const narrow = weekday({ weekday: 'narrow' })
const monthDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Shorter bars never vanish, so a quiet day is still visible as a day.
const minHeight = 8

export async function ContentActivity({ req }: WidgetServerProps) {
  if (!req.user) return null
  const activity = await getContentActivity(req)
  const max = Math.max(0, ...(activity?.days.map(({ count }) => count) ?? []))

  return (
    <section className={styles.card} aria-label="Content activity">
      <div className={styles.cardHeader}>
        <h2>Content activity</h2>
        <span className={styles.detail}>Last 7 days</span>
      </div>
      {!activity ? <p className={styles.detail}>Unavailable</p> : !activity.total ? (
        <p className={styles.detail}>No updates in the last 7 days</p>
      ) : (
        <>
          <ol className={styles.bars}>
            {activity.days.map(({ date, count }, index) => {
              const day = new Date(`${date}T00:00:00Z`)
              return (
                <li key={date}>
                  <div
                    data-bar
                    data-current={index === activity.days.length - 1 ? true : undefined}
                    role="img"
                    aria-label={`${short.format(day)} ${monthDay.format(day)}: ${count} ${count === 1 ? 'update' : 'updates'}`}
                    style={{ height: `${Math.max(minHeight, Math.round((count / max) * 100))}%` }}
                  />
                </li>
              )
            })}
          </ol>
          <ol className={styles.days} aria-hidden="true">
            {activity.days.map(({ date }) => <li key={date}>{narrow.format(new Date(`${date}T00:00:00Z`))}</li>)}
          </ol>
        </>
      )}
    </section>
  )
}
