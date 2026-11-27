import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getDashboardHeader } from './getDashboardHeader'
import { CalendarIcon, PlusIcon } from './icons'
import styles from './Dashboard.module.css'

export async function DashboardHeader({ req, permissions }: WidgetServerProps) {
  if (!req.user) return null
  const { siteName, date, dateTime, action } = await getDashboardHeader(req, permissions)

  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.title}>Dashboard</h1>
        {siteName && <p className={styles.subtitle} data-site-name>{siteName}</p>}
      </div>
      <div className={styles.headerActions}>
        <time className={styles.date} dateTime={dateTime}><CalendarIcon />{date}</time>
        {action && <Link className={styles.primaryAction} href={action.href}><PlusIcon />{action.label}</Link>}
      </div>
    </header>
  )
}
