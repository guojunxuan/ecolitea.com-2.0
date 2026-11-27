import type { ReactNode } from 'react'
import styles from './index.module.css'

export function SkipLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className={styles.skipLink} href={href}>
      {children}
    </a>
  )
}
