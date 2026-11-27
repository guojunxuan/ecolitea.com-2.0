import type { WidgetServerProps } from 'payload'
import { getOverview } from './getOverview'
import { DocumentIcon, GlobeIcon, MailIcon, ProductIcon } from './icons'
import styles from './Dashboard.module.css'

export async function Overview({ req }: WidgetServerProps) {
  if (!req.user) return null
  const overview = await getOverview(req)
  const number = new Intl.NumberFormat('en')

  return (
    <section aria-label="Overview">
      {overview ? (
        <ul className={styles.metrics}>
          <li className={styles.metric}>
            <span className={styles.tile} data-tone="success"><ProductIcon /></span>
            <div>
              <p className={styles.metricLabel}>Published products</p>
              <p className={`${styles.metricValue} ${styles.metricSuccess}`}>{number.format(overview.published)}</p>
              <p className={styles.detail}>{number.format(overview.drafts)} drafts</p>
            </div>
          </li>
          <li className={styles.metric}>
            <span className={styles.tile} data-tone="warning"><MailIcon /></span>
            <div>
              <p className={styles.metricLabel}>New quote requests</p>
              <p className={`${styles.metricValue} ${overview.quotes > 0 ? styles.metricWarning : ''}`}>
                {number.format(overview.quotes)}
              </p>
            </div>
          </li>
          <li className={styles.metric}>
            <span className={styles.tile} data-tone="component"><DocumentIcon /></span>
            <div>
              <p className={styles.metricLabel}>Blog posts</p>
              <p className={styles.metricValue}>{number.format(overview.blogs)}</p>
            </div>
          </li>
          <li className={styles.metric}>
            <span className={styles.tile} data-tone="brand"><GlobeIcon /></span>
            <div>
              <p className={styles.metricLabel}>Enabled languages</p>
              <p className={`${styles.metricValue} ${styles.metricBrand}`}>{number.format(overview.languages)}</p>
            </div>
          </li>
        </ul>
      ) : <p className={styles.card}>Unavailable</p>}
    </section>
  )
}
