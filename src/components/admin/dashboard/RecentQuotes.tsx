import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getRecentQuotes } from './getRecentQuotes'
import styles from './Dashboard.module.css'

const statusLabels = { new: 'New', contacted: 'Contacted', closed: 'Closed' } as const
const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function age(createdAt: string, now: number) {
  const minutes = Math.round((Date.parse(createdAt) - now) / 60_000)
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute')
  if (Math.abs(minutes) < 24 * 60) return relativeTime.format(Math.round(minutes / 60), 'hour')
  return relativeTime.format(Math.round(minutes / (24 * 60)), 'day')
}

export async function RecentQuotes({ req }: WidgetServerProps) {
  if (!req.user) return null
  const quotes = await getRecentQuotes(req)
  const base = `${req.payload.config.routes.admin}/collections/quote-requests`
  const now = Date.now()

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
                <span>
                  <strong>{quote.name}</strong>{' '}
                  <span className={styles.chip} data-status={quote.status}>{statusLabels[quote.status]}</span>
                  <span className={styles.detail}>{[quote.company, quote.product].filter(Boolean).join(' · ')}</span>
                </span>
                <time className={styles.detail} dateTime={quote.createdAt}>{age(quote.createdAt, now)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
