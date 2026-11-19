import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const custom = readFileSync('src/app/(payload)/custom.css', 'utf8')
const installed = readFileSync('node_modules/@payloadcms/ui/dist/styles.css', 'utf8')
const { blocks, declarations } = auditCss(custom)

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
    expect(custom).not.toMatch(/!\s*important|Ecolitea|Payload Website Template|@payloadcms'/i)
  })
})
