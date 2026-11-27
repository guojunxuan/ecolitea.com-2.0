import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { Config } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ui = vi.hoisted(() => ({ openModal: vi.fn() }))
vi.mock('@payloadcms/ui', () => ({
  commandPaletteSlug: 'command-palette',
  useModal: () => ({ openModal: ui.openModal }),
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { adminThemePlugin } from '@/plugins/adminTheme'
import { SidebarSearch } from '@/plugins/adminTheme/sidebar/SidebarSearch'

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

describe('sidebar slot registration', () => {
  const base: Config = {
    secret: 'config-contract',
    db: { name: 'test', defaultIDType: 'text', init: () => { throw new Error('no database') } },
    admin: { user: 'users', importMap: { baseDir: '/project' } },
  }
  const brand = { path: '@/plugins/adminTheme/brand/AdminIcon#AdminIcon', serverProps: { showName: true } }

  it('appends the search under the brand and leaves afterNav untouched', () => {
    const config: Config = {
      ...base,
      admin: { ...base.admin, components: { beforeNavLinks: ['/custom/Before'], afterNav: ['/custom/After'] } },
    }
    const { components } = adminThemePlugin()(config).admin!
    expect(components?.beforeNavLinks).toEqual([
      '/custom/Before', brand, '@/plugins/adminTheme/sidebar/SidebarSearch#SidebarSearch',
    ])
    expect(components?.afterNav).toEqual(['/custom/After'])
    expect(config.admin?.components?.afterNav).toEqual(['/custom/After'])
  })

  it('leaves the slots untouched when the plugin is disabled', () => {
    expect(adminThemePlugin({ enabled: false })(base)).toBe(base)
    expect(base.admin?.components).toBeUndefined()
  })
})
