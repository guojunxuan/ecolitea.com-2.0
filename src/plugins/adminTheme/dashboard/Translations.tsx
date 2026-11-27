import type { WidgetServerProps } from 'payload'
import type { CSSProperties } from 'react'
import { getTranslationSummary } from './summarizeTranslations'
import styles from './Dashboard.module.css'

export async function Translations({ req }: WidgetServerProps) {
  const summary = await getTranslationSummary(req)
  if (summary.status === 'hidden') return null

  return (
    <section className={styles.card} aria-label="Translations">
      <div className={styles.cardHeader}>
        <h2>Translations</h2>
        {summary.status === 'ready' && <span className={styles.detail}>{summary.synced} of {summary.enabled}</span>}
      </div>
      {summary.status === 'ready' ? (
        <div className={styles.translations}>
          <div
            className={styles.ring}
            role="img"
            aria-label={`${summary.percent}% of enabled languages synced`}
            style={{ '--p': summary.percent } as CSSProperties}
          >
            <span>{summary.percent}%</span>
          </div>
          <dl className={styles.legend}>
            <div><dt><span className={styles.dot} data-tone="success" />Synced</dt><dd>{summary.synced}</dd></div>
            <div><dt><span className={styles.dot} data-tone="warning" />In progress</dt><dd>{summary.inProgress}</dd></div>
            <div><dt><span className={styles.dot} data-tone="danger" />Failed</dt><dd>{summary.failed}</dd></div>
          </dl>
        </div>
      ) : (
        <p className={styles.detail}>{summary.status === 'empty' ? 'No languages enabled' : 'Unavailable'}</p>
      )}
    </section>
  )
}
