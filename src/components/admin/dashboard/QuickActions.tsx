import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getQuickActions } from './getQuickActions'
import styles from './Dashboard.module.css'

export function QuickActions({ req, permissions }: WidgetServerProps) {
  if (!req.user) return null
  const actions = getQuickActions(req, permissions)
  if (!actions.length) return null

  return (
    <nav aria-label="Quick actions" className={styles.actions}>
      {actions.map(({ href, label }) => (
        <Link className={styles.action} key={href} href={href}>{label}</Link>
      ))}
    </nav>
  )
}
