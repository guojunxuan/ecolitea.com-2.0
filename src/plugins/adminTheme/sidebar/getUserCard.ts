import type { SanitizedConfig } from 'payload'

type CardUser = { name?: string | null; email?: string | null; role?: string | null }

const roleLabels: Record<string, string> = { admin: 'Administrator', editor: 'Editor' }

/** Presentation model for the sidebar user card. */
export function getUserCard(user: CardUser, config: Pick<SanitizedConfig, 'routes' | 'admin'>) {
  const name = user.name?.trim() || user.email || 'Account'
  const role = user.role ? (roleLabels[user.role] ?? user.role) : undefined
  const account = config.admin?.routes?.account ?? '/account'

  return {
    name,
    initial: Array.from(name)[0]!.toLocaleUpperCase('en'),
    ...(role && { role }),
    href: `${config.routes.admin}${account}`,
  }
}
