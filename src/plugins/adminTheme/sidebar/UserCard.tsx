import type { ServerProps } from 'payload'
import Link from 'next/link'
import { getUserCard } from './getUserCard'
import styles from './Sidebar.module.css'

export function UserCard({ user, payload }: Pick<ServerProps, 'user' | 'payload'>) {
  if (!user) return null
  const { name, initial, role, href } = getUserCard(user, payload.config)

  return (
    // The name is already shown by Payload's own user menu, so the card shows only the role.
    // The accessible name still carries the name so the link stays identifiable.
    <div className={styles.userSlot}>
      <Link className={styles.userCard} href={href} aria-label={role ? `${name}, ${role}` : name}>
        <span className={styles.avatar} aria-hidden="true">{initial}</span>
        {role && <span className={styles.userText}>{role}</span>}
      </Link>
    </div>
  )
}
