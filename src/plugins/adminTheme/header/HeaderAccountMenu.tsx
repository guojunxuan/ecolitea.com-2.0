'use client'

import { UserMenu } from '@payloadcms/ui'

/**
 * Payload's own account menu, rendered in the top bar through the public `admin.components.actions`
 * slot. Nothing is reimplemented: avatar, theme submenu and logout all come from Payload.
 */
export function HeaderAccountMenu() {
  // showTitle keeps the username next to the avatar, as Payload shows it in the sidebar.
  return <UserMenu showTitle />
}
