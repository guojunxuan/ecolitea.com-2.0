import type { WidgetServerProps } from 'payload'
import { getSystemStatus } from './getSystemStatus'
import { ClockIcon, CloudIcon, MailIcon, TranslateIcon } from './icons'
import styles from './Dashboard.module.css'

const scheduleTime = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export async function SystemStatus({ req }: WidgetServerProps) {
  const status = await getSystemStatus(req)
  if (!status) return null

  const schedule = typeof status.schedule === 'string' ? status.schedule : (
    <time dateTime={status.schedule.next}>{scheduleTime.format(new Date(status.schedule.next))} UTC</time>
  )
  const normal = status.overall === 'normal'

  return (
    <section className={styles.card} aria-label="System status">
      <div className={styles.cardHeader}>
        <h2>System status</h2>
        <span className={styles.detail}>
          <span className={styles.dot} data-tone={normal ? 'success' : 'warning'} />
          {normal ? 'All systems normal' : 'Needs attention'}
        </span>
      </div>
      <dl className={styles.status}>
        <div><dt><MailIcon />Email</dt><dd>{status.email}</dd></div>
        <div><dt><TranslateIcon />Translation</dt><dd>{status.translation}</dd></div>
        <div><dt><CloudIcon />Storage</dt><dd>{status.storage}</dd></div>
        <div><dt><ClockIcon />Scheduled publishing</dt><dd>{schedule}</dd></div>
      </dl>
    </section>
  )
}
