import type { WidgetServerProps } from 'payload'
import { getSystemStatus } from './getSystemStatus'
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

  return (
    <section className={styles.card} aria-label="System status">
      <div className={styles.cardHeader}><h2>System status</h2></div>
      <dl className={styles.status}>
        <div><dt>Email</dt><dd>{status.email}</dd></div>
        <div><dt>Translation</dt><dd>{status.translation}</dd></div>
        <div><dt>Storage</dt><dd>{status.storage}</dd></div>
        <div><dt>Scheduled publishing</dt><dd>{schedule}</dd></div>
      </dl>
    </section>
  )
}
