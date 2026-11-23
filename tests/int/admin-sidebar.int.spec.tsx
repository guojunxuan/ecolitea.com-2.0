import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { Config, ServerProps } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ui = vi.hoisted(() => ({ openModal: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  commandPaletteSlug: 'command-palette',
  useModal: () => ({ openModal: ui.openModal }),
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { adminThemePlugin } from '@/plugins/adminTheme'
import { SidebarSearch } from '@/plugins/adminTheme/sidebar/SidebarSearch'
import { UserCard } from '@/plugins/adminTheme/sidebar/UserCard'
import { getUserCard } from '@/plugins/adminTheme/sidebar/getUserCard'

beforeEach(() => ui.openModal.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('native command palette contract', () => {
  // The sidebar search only opens Payload's palette. If Payload stops mounting or exporting
  // it, this fails and the sidebar entry must be revisited instead of silently doing nothing.
  it('is still exported publicly and mounted by the default template', () => {
    const exports = readFileSync('node_modules/@payloadcms/ui/dist/exports/client/index.d.ts', 'utf8')
    expect(exports).toMatch(/export \{ CommandPalette, commandPaletteSlug \}/)
    expect(exports).toMatch(/export \{ Modal, useModal \}/)
    const template = readFileSync('node_modules/@payloadcms/ui/dist/templates/Default/index.js', 'utf8')
    expect(template).toContain('_jsx(CommandPalette, {})')
    const palette = readFileSync('node_modules/@payloadcms/ui/dist/elements/CommandPalette/index.js', 'utf8')
    expect(palette).toContain("commandPaletteSlug = 'command-palette'")
    expect(palette).toContain('cmdCtrlKey: true')
  })
})

describe('SidebarSearch', () => {
  it('opens the native command palette and does not bind its own shortcut', () => {
    render(<SidebarSearch />)

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(ui.openModal).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'commandPalette:title' }))
    expect(ui.openModal).toHaveBeenCalledExactlyOnceWith('command-palette')
  })

  it('shows the shortcut that matches the platform', () => {
    vi.stubGlobal('navigator', { ...navigator, platform: 'MacIntel' })
    const { unmount } = render(<SidebarSearch />)
    expect(screen.getByText('⌘K')).toBeTruthy()
    unmount()
    vi.stubGlobal('navigator', { ...navigator, platform: 'Win32' })
    render(<SidebarSearch />)
    expect(screen.getByText('Ctrl K')).toBeTruthy()
  })
})

describe('getUserCard', () => {
  const config = { routes: { admin: '/admin' }, admin: { routes: { account: '/account' } } } as unknown as ServerProps['payload']['config']

  it('maps known roles to readable labels and links to the account page', () => {
    expect(getUserCard({ name: 'Jason Li', email: 'jason@example.invalid', role: 'admin' }, config)).toEqual({
      name: 'Jason Li', initial: 'J', role: 'Administrator', href: '/admin/account',
    })
    expect(getUserCard({ name: 'Mei', email: 'mei@example.invalid', role: 'editor' }, config)).toMatchObject({ role: 'Editor' })
  })

  it('falls back to the email, the raw role, and no role', () => {
    expect(getUserCard({ name: '  ', email: 'zoe@example.invalid', role: 'reviewer' }, config))
      .toMatchObject({ name: 'zoe@example.invalid', initial: 'Z', role: 'reviewer' })
    expect(getUserCard({ email: 'a@example.invalid' }, config).role).toBeUndefined()
  })

  it('uses the configured admin and account routes, and the first character of non-Latin names', () => {
    const custom = { routes: { admin: '/cms' }, admin: { routes: { account: '/me' } } } as unknown as typeof config
    expect(getUserCard({ name: '李明', email: 'li@example.invalid' }, custom)).toMatchObject({ initial: '李', href: '/cms/me' })
  })
})

describe('UserCard', () => {
  const payload = { config: { routes: { admin: '/admin' }, admin: { routes: { account: '/account' } } } }

  it('shows the initial and role, keeping the name only in the accessible name', () => {
    render(UserCard({ user: { name: 'Jason Li', email: 'j@example.invalid', role: 'admin' }, payload } as never) as React.ReactElement)
    const link = screen.getByRole('link', { name: 'Jason Li, Administrator' })
    expect(link.getAttribute('href')).toBe('/admin/account')
    // Payload's user menu already shows the name; the card must not repeat it visibly.
    expect(link.textContent).toBe('JAdministrator')
    expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe('J')
  })

  it('falls back to the name alone as the accessible name without a role', () => {
    render(UserCard({ user: { name: 'Mei', email: 'mei@example.invalid' }, payload } as never) as React.ReactElement)
    const link = screen.getByRole('link', { name: 'Mei' })
    expect(link.textContent).toBe('M')
  })

  it('renders nothing without a user', () => {
    expect(UserCard({ user: undefined, payload } as never)).toBeNull()
  })
})

describe('sidebar slot registration', () => {
  const base: Config = {
    secret: 'config-contract',
    db: { name: 'test', defaultIDType: 'text', init: () => { throw new Error('no database') } },
    admin: { user: 'users', importMap: { baseDir: '/project' } },
  }
  const brand = { path: '@/plugins/adminTheme/brand/AdminIcon#AdminIcon', serverProps: { showName: true } }

  it('appends the search under the brand and the user card after the nav, keeping existing slots', () => {
    const config: Config = {
      ...base,
      admin: { ...base.admin, components: { beforeNavLinks: ['/custom/Before'], afterNav: ['/custom/After'] } },
    }
    const { components } = adminThemePlugin()(config).admin!
    expect(components?.beforeNavLinks).toEqual([
      '/custom/Before', brand, '@/plugins/adminTheme/sidebar/SidebarSearch#SidebarSearch',
    ])
    expect(components?.afterNav).toEqual(['/custom/After', '@/plugins/adminTheme/sidebar/UserCard#UserCard'])
    expect(config.admin?.components?.afterNav).toEqual(['/custom/After'])
  })

  it('leaves the slots untouched when the plugin is disabled', () => {
    expect(adminThemePlugin({ enabled: false })(base)).toBe(base)
    expect(base.admin?.components).toBeUndefined()
  })
})
