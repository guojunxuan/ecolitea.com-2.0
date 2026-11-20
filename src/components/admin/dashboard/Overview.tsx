import type { WidgetServerProps } from 'payload'
import { getOverview } from './getOverview'
import styles from './Dashboard.module.css'

export async function Overview({ req }: WidgetServerProps) {
  if (!req.user) return null
  const overview = await getOverview(req)
  const number = new Intl.NumberFormat('en')

  return (
    <section aria-label="Overview">
      {overview ? (
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>Published products</dt>
            <dd className={styles.metricSuccess}>{number.format(overview.published)}</dd>
            <dd className={styles.detail}>{number.format(overview.drafts)} drafts</dd>
          </div>
          <div className={styles.metric}>
            <dt>New quote requests</dt>
            <dd className={overview.quotes > 0 ? styles.metricWarning : undefined}>
              {number.format(overview.quotes)}
            </dd>
          </div>
          <div className={styles.metric}>
            <dt>Blog posts</dt>
            <dd>{number.format(overview.blogs)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>Enabled languages</dt>
            <dd className={styles.metricBrand}>{number.format(overview.languages)}</dd>
          </div>
        </dl>
      ) : <p className={styles.card}>Unavailable</p>}
    </section>
  )
}
