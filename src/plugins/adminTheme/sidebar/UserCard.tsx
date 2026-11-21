import type { ServerProps } from 'payload'
import Link from 'next/link'
import { getUserCard } from './getUserCard'
import styles from './Sidebar.module.css'

export function UserCard({ user, payload }: Pick<ServerProps, 'user' | 'payload'>) {
  if (!user) return null
  const { name, initial, role, href } = getUserCard(user, payload.config)

  return (
    <div className={styles.userSlot}>
      <Link className={styles.userCard} href={href}>
        <span className={styles.avatar} aria-hidden="true">{initial}</span>
        <span className={styles.userText}>
          <strong>{name}</strong>
          {role && <small>{role}</small>}
        </span>
      </Link>
    </div>
  )
}
