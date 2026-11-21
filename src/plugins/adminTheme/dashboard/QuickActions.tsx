import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getQuickActions } from './getQuickActions'
import { collectionIcons } from './icons'
import styles from './Dashboard.module.css'

const tones = { products: 'success', blogs: 'component', media: 'brand' } as const

export function QuickActions({ req, permissions }: WidgetServerProps) {
  if (!req.user) return null
  const actions = getQuickActions(req, permissions)
  if (!actions.length) return null

  return (
    <section className={styles.card} aria-label="Quick actions">
      <div className={styles.cardHeader}><h2>Quick actions</h2></div>
      <nav aria-label="Quick actions" className={styles.actions}>
        {actions.map(({ collection, href, label }) => {
          const Icon = collectionIcons[collection]
          return (
            <Link className={styles.action} key={href} href={href}>
              <span className={styles.tile} data-tone={tones[collection]} data-size="small"><Icon /></span>
              {label}
            </Link>
          )
        })}
      </nav>
    </section>
  )
}
