import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getRecentQuotes } from './getRecentQuotes'
import styles from './Dashboard.module.css'

const statusLabels = { new: 'New', contacted: 'Contacted', closed: 'Closed' } as const
export async function RecentQuotes({ req }: WidgetServerProps) {
  if (!req.user) return null
  const quotes = await getRecentQuotes(req)
  const base = `${req.payload.config.routes.admin}/collections/quote-requests`

  return (
    <section className={styles.card} aria-label="Recent quote requests">
      <div className={styles.cardHeader}>
        <h2>Recent quote requests</h2>
        {Boolean(quotes?.length) && <Link href={base}>View all</Link>}
      </div>
      {!quotes ? <p className={styles.detail}>Unavailable</p> : !quotes.length ? (
        <p className={styles.detail}>No quote requests yet</p>
      ) : (
        <ul className={styles.quotes}>
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link href={`${base}/${encodeURIComponent(quote.id)}`} className={styles.quote}>
                <span className={styles.avatar} data-status={quote.status} aria-hidden="true">
                  {Array.from(quote.name.trim())[0]?.toLocaleUpperCase('en')}
                </span>
                <span className={styles.quoteBody}>
                  <strong>{quote.name}</strong>
                  <span className={styles.detail}>{[quote.company, quote.product].filter(Boolean).join(' · ')}</span>
                </span>
                <span className={styles.quoteMeta}>
                  <span className={styles.chip} data-status={quote.status}>{statusLabels[quote.status]}</span>
                  <time className={styles.detail} dateTime={quote.createdAt}>{quote.relativeTime}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
