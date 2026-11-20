import type { WidgetServerProps } from 'payload'
import Link from 'next/link'
import { getSiteSetup } from './getSiteSetup'
import styles from './Dashboard.module.css'

export async function SiteSetup({ req }: WidgetServerProps) {
  const status = await getSiteSetup(req)
  if (status === 'hidden' || status === 'complete') return null

  return (
    <section aria-label="Site setup" className={styles.banner}>
      {status === 'unavailable' ? <p>Unavailable</p> : (
        <>
          <strong>Complete site setup</strong>
          <Link className={styles.primaryAction} href={`${req.payload.config.routes.admin}/globals/site-settings`}>
            Open Site Settings
          </Link>
        </>
      )}
    </section>
  )
}
