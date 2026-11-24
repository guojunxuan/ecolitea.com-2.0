import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const custom = readFileSync('src/app/(payload)/custom.css', 'utf8')
const installed = readFileSync('node_modules/@payloadcms/ui/dist/styles.css', 'utf8')
const theme = readFileSync('src/plugins/adminTheme/theme.css', 'utf8')
const { blocks, declarations } = auditCss(theme)

it('leaves the Payload layout stylesheet empty so removing the plugin removes its theme', () => {
  expect(custom.trim()).toBe('')
})

describe('Enhanced layout contract', () => {
  const enhancedCss = readFileSync('src/plugins/adminTheme/enhanced.css', 'utf8')
  const enhanced = auditCss(enhancedCss)
  const classes = (header: string) => [...header.matchAll(/\.([_a-zA-Z][\w-]*)/g)]
    .map(([, name]) => name)
  const selectors = enhanced.blocks.filter(({ header }) => !header.startsWith('@'))
  const installedCss = auditCss(installed)
  // Payload nests some rules, so a class may only appear inside another block's header.
  const installedClasses = new Set(installedCss.blocks.flatMap(({ header }) => classes(header)))

  it('depends only on classes still present in the installed Payload CSS', () => {
    expect(selectors.length).toBeGreaterThan(0)
    for (const { header } of selectors) {
      for (const name of classes(header)) {
        expect(installedClasses, `Payload removed .${name} from its CSS. Review enhanced layout.`)
          .toContain(name)
      }
    }
  })

  it('styles tab buttons through the ARIA contract that the installed Tabs element still renders', () => {
    const tabs = readFileSync('node_modules/@payloadcms/ui/dist/elements/Tabs/index.js', 'utf8')
    expect(tabs).toContain('role: "tab"')
    expect(tabs).toContain('"aria-selected": isActive')
    const headers = selectors.map(({ header }) => header)
    expect(headers).toEqual(expect.arrayContaining([
      '.tabs-field__tabs',
      ".tabs-field__tabs [role='tab']",
      ".tabs-field__tabs [role='tab'][aria-selected='true']",
    ]))
    for (const header of headers.filter((item) => item.includes('[role='))) {
      expect(header.startsWith('.tabs-field__tabs '), header).toBe(true)
    }
  })

  it('only sets Payload custom properties that the installed CSS still reads', () => {
    const readsNative = (name: string) => installed.includes(`var(${name}`)
    const custom = enhanced.declarations.filter(({ prop }) => prop.startsWith('--') && !prop.startsWith('--admin-'))
    expect(custom.map(({ prop }) => prop)).toEqual(expect.arrayContaining(['--color-bg', '--field-tabs-edge-display']))
    for (const { prop } of custom) expect(readsNative(prop), `${prop} is no longer read by Payload`).toBe(true)
  })

  it('groups fields on the secondary surface and keeps nested collapsibles distinct', () => {
    const get = (selector: string, prop: string) =>
      enhanced.declarations.find((declaration) =>
        declaration.header.split(',').map((item) => item.trim()).includes(selector) && declaration.prop === prop)?.value
    for (const header of ['.group-field', '.collapsible']) {
      expect(get(header, 'background-color'), header).toBe('var(--color-bg-secondary)')
      expect(get(header, 'border-radius'), header).toBe('var(--admin-panel-radius)')
    }
    expect(get('.group-field', 'padding')).toBe('var(--admin-group-padding)')
    expect(get('.collapsible .collapsible', 'background-color')).toBe('var(--color-bg)')
    expect(get('.group-field .collapsible', 'background-color')).toBe('var(--color-bg)')
  })

  it('references only tokens: no literal colors, shadows or important declarations', () => {
    expect(enhanced.declarations.length).toBeGreaterThan(0)
    for (const { header, prop, value } of enhanced.declarations) {
      expect(value, `${header} { ${prop} }`).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|!\s*important/i)
    }
    expect(enhancedCss).not.toMatch(/Ecolitea/i)
  })

  it('changes presentation only: no hidden elements or generated content', () => {
    for (const { header, prop, value } of enhanced.declarations) {
      expect(`${prop}: ${value}`, header).not.toMatch(/^(display: none|visibility: hidden|content:)/)
    }
  })

  it('gives the window panel its margin, radius and shadow from tokens, and drops them on narrow screens', () => {
    const panel = enhanced.declarations.filter(({ header, ancestors }) =>
      header === '.template-default__wrap' && ancestors.length === 1)
    const value = (prop: string) => panel.find((declaration) => declaration.prop === prop)?.value
    expect(value('border-radius')).toBe('var(--admin-window-radius)')
    expect(value('box-shadow')).toBe('var(--admin-window-shadow)')
    expect(value('margin')).toContain('var(--admin-window-gap)')
    expect(enhanced.declarations.find(({ header, prop }) =>
      header === '.template-default' && prop === 'background-color')?.value).toBe('var(--admin-canvas)')

    const narrow = enhanced.declarations.filter(({ header, ancestors }) =>
      header === '.template-default__wrap' && ancestors[0] === '@media (max-width: 768px)')
    expect(narrow.map(({ prop, value }) => `${prop}: ${value}`)).toEqual(
      expect.arrayContaining(['margin: 0', 'border-radius: 0', 'box-shadow: none']),
    )
  })

  it('draws the list table as a rounded card with token-sized rows', () => {
    const get = (header: string, prop: string) =>
      enhanced.declarations.find((declaration) => declaration.header === header && declaration.prop === prop)?.value
    expect(get('.collection-list .table', 'border-radius')).toBe('var(--admin-panel-radius)')
    expect(get('.collection-list .table tbody tr', 'height')).toBe('var(--admin-row-height)')
    expect(get('.collection-list .table th', 'background-color')).toBe('var(--color-bg-secondary)')
  })
})

describe('Header account menu contract', () => {
  const accountCss = readFileSync('src/plugins/adminTheme/header/accountMenu.css', 'utf8')
  const classes = (header: string) => [...header.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map(([, name]) => name)
  const installedClasses = new Set(auditCss(installed).blocks.flatMap(({ header }) => classes(header)))

  it('depends only on Payload classes still present in the installed Payload CSS', () => {
    const selectors = auditCss(accountCss).blocks.filter(({ header }) => !header.startsWith('@'))
    expect(selectors.map(({ header }) => header.trim())).toContain('.nav .user-menu')
    const payloadClasses = new Set(selectors.flatMap(({ header }) => classes(header))
      .filter((name) => !name.startsWith('admin-account-menu')))
    expect([...payloadClasses].sort()).toEqual(['btn__icon', 'nav', 'user-menu', 'user-menu__trigger'])
    for (const name of payloadClasses) {
      expect(installedClasses, `Payload removed .${name}. Review the header account menu.`).toContain(name)
    }
  })

  it('relies on Payload still exporting UserMenu and rendering it in the sidebar', () => {
    const client = readFileSync('node_modules/@payloadcms/ui/dist/exports/client/index.d.ts', 'utf8')
    expect(client).toMatch(/export \{ UserMenu \}/)
    expect(client).toMatch(/export \{ Account \}/)
    const nav = readFileSync('node_modules/@payloadcms/ui/dist/elements/Nav/index.js', 'utf8')
    expect(nav, 'Payload no longer renders UserMenu in the sidebar. Review the header account menu.')
      .toMatch(/_jsx\(UserMenu,/)
    const userMenu = readFileSync('node_modules/@payloadcms/ui/dist/elements/UserMenu/index.js', 'utf8')
    expect(userMenu).toMatch(/const baseClass = 'user-menu'/)
    expect(userMenu).toMatch(/__trigger/)
  })
})

it('defines the window layout sizes and surfaces as Admin tokens in both palettes', () => {
  const value = (header: string, prop: string) =>
    declarations.find((declaration) => declaration.header === header && declaration.prop === prop)?.value
  expect(value(':root', '--admin-window-gap')).toBe('8px')
  expect(value(':root', '--admin-window-radius')).toBe('14px')
  expect(value(':root', '--admin-widget-radius')).toBe('16px')
  expect(value(':root', '--admin-row-height')).toBe('44px')
  expect(value(':root', '--admin-group-padding')).toBe('14px 16px')
  expect(value(':root', '--admin-group-gap')).toBe('14px')
  for (const header of [':root', "html[data-theme='dark']"]) {
    expect(value(header, '--admin-canvas'), `${header} canvas`).toBeTruthy()
    expect(value(header, '--admin-window-shadow'), `${header} shadow`).toBeTruthy()
  }
  expect(value(':root', '--admin-canvas')).not.toBe(value(':root', '--admin-bg'))
  expect(value("html[data-theme='dark']", '--admin-canvas')).not.toBe(value("html[data-theme='dark']", '--admin-bg'))
})

describe('Admin theme token contract', () => {
  it('defines an accent for the default and dark themes', () => {
    expect(declarations).toEqual(expect.arrayContaining([
      expect.objectContaining({ header: ':root', prop: '--admin-brand', value: '#007aff' }),
      expect.objectContaining({ header: "html[data-theme='dark']", prop: '--admin-brand', value: '#0a84ff' }),
    ]))
  })

  it('maps only installed semantic tokens on the supported selectors', () => {
    const allowed = [':root', "html[data-theme='light']", "html[data-theme='dark']"]
    const installedTokens = new Set(
      [...installed.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name),
    )
    for (const { header, ancestors } of blocks) {
      expect(ancestors).toEqual([])
      for (const selector of header.split(',')) expect(allowed).toContain(selector.trim())
    }
    const overrides = declarations.filter(({ prop }) => !prop.startsWith('--admin-'))
    expect(overrides.map(({ prop }) => prop)).toContain('--color-bg-brand')
    for (const { prop } of overrides) {
      expect(prop).not.toMatch(/^--ramp-/)
      expect(installedTokens, prop).toContain(prop)
    }
    expect(theme).not.toMatch(/!\s*important|Ecolitea|Payload Website Template|@payloadcms'/i)
  })
})

it('keeps light status text readable on the tinted status backgrounds', () => {
  const hex = (prop: string) => {
    const { value = '' } = declarations.find((declaration) => declaration.prop === prop) ?? {}
    const token = value.match(/^var\((--admin-[\w-]+)\)$/)?.[1] ?? prop
    const color = declarations.find((declaration) => declaration.prop === token)?.value ?? ''
    expect(color).toMatch(/^#[0-9a-f]{6}$/)
    return color.slice(1).match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255)
  }
  const luminance = (channels: number[]) => channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    return sum + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)

  for (const [tone, opacity] of [['success', 0.15], ['warning', 0.16], ['danger', 0.15]] as const) {
    const foreground = luminance(hex(`--color-text-${tone}`))
    const surface = luminance(hex(`--color-bg-${tone}`).map((channel) => 1 - opacity + channel * opacity))
    expect((surface + 0.05) / (foreground + 0.05), tone).toBeGreaterThanOrEqual(4.5)
  }
})
