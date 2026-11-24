'use client'

import { Account, UserMenu } from '@payloadcms/ui'

/**
 * Payload's own account menu, rendered in the top bar through the public `admin.components.actions`
 * slot. Payload's menu button shows only a chevron, so Payload's own Account avatar graphic is laid
 * over the start of the button. It ignores pointer events, so clicks still reach the native button;
 * the menu, theme submenu and logout all come from Payload.
 */
export function HeaderAccountMenu() {
  return (
    <div className="admin-account-menu">
      <span className="admin-account-menu__avatar" aria-hidden="true">
        <Account />
      </span>
      <UserMenu />
    </div>
  )
}
