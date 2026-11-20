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

it('depends only on installed sidebar classes for the optional secondary surface', () => {
  const enhancedCss = readFileSync('src/plugins/adminTheme/enhanced.css', 'utf8')
  const enhanced = auditCss(enhancedCss)
  const classes = (header: string) => [...header.matchAll(/\.([_a-zA-Z][\w-]*)/g)]
    .map(([, name]) => name)
  const installedClasses = new Set(auditCss(installed).blocks.flatMap(({ header }) => classes(header)))

  expect(enhanced.blocks.map(({ header }) => header)).toEqual(['.nav'])
  for (const { header } of enhanced.blocks) {
    for (const name of classes(header)) {
      expect(installedClasses, `Payload removed .${name} from its CSS. Review enhanced layout.`)
        .toContain(name)
    }
  }
  expect(enhanced.declarations.map(({ prop, value }) => ({ prop, value }))).toEqual([
    { prop: 'background-color', value: 'var(--color-bg-secondary)' },
  ])
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
