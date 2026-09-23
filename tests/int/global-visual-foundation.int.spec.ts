import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('global visual foundation', () => {
  it('defines all nine margin-free type roles and the desktop heading steps', () => {
    const css = read('src/styles/typography.css')
    const rules = auditCss(css)
    const expected = {
      display: ['48px', '52px', '600'],
      'heading-large': ['28px', '32px', '600'],
      'heading-medium': ['24px', '30px', '600'],
      'heading-small': ['20px', '28px', '600'],
      'body-large': ['18px', '28px', '400'],
      body: ['16px', '26px', '400'],
      'body-small': ['14px', '22px', '400'],
      caption: ['12px', '18px', '400'],
      code: ['14px', '22px', '400'],
    }
    for (const [role, [size, height, weight]] of Object.entries(expected)) {
      const selector = `.website-type-${role}`
      const declarations = rules.declarations.filter(
        (entry) =>
          entry.header === selector &&
          !entry.ancestors.some((ancestor) => ancestor.startsWith('@media')),
      )
      expect(declarations.find((entry) => entry.prop === 'font-size')?.value, selector).toBe(size)
      expect(declarations.find((entry) => entry.prop === 'line-height')?.value, selector).toBe(
        height,
      )
      expect(declarations.find((entry) => entry.prop === 'font-weight')?.value, selector).toBe(
        weight,
      )
      expect(declarations.find((entry) => entry.prop === 'font-family')?.value, selector).toBe(
        role === 'code' ? 'var(--website-font-mono)' : 'var(--website-font-sans)',
      )
    }
    expect(rules.declarations.filter((entry) => entry.prop.startsWith('margin'))).toEqual([])
    for (const [role, size, height] of [
      ['display', '56px', '60px'],
      ['heading-large', '40px', '44px'],
      ['heading-medium', '28px', '34px'],
    ]) {
      const declarations = rules.declarations.filter(
        (entry) =>
          entry.header === `.website-type-${role}` &&
          entry.ancestors.includes('@media (width >= 48rem)'),
      )
      expect(declarations.find((entry) => entry.prop === 'font-size')?.value).toBe(size)
      expect(declarations.find((entry) => entry.prop === 'line-height')?.value).toBe(height)
    }
  })

  it('keeps every content element rule within the owned RichText scope', () => {
    const rules = auditCss(read('src/styles/content.css'))
    for (const block of rules.blocks) {
      if (block.header.startsWith('@') || block.header === ':scope') continue
      const scoped =
        block.header.includes('.payload-richtext') ||
        block.ancestors.some((ancestor) => /^@scope\s*\([^)]*\.payload-richtext/.test(ancestor))
      expect(scoped, `Unscoped selector at line ${block.line}: ${block.header}`).toBe(true)
    }
  })

  it('defines the approved primitives and semantic schemes', () => {
    const css = read('src/styles/tokens.css')
    for (const declaration of [
      '--website-color-brand-black: #0a0a0a;',
      '--website-color-neutral-900: #262629;',
      '--website-color-neutral-600: #76767f;',
      '--website-color-foreground: var(--website-color-neutral-900);',
      '--website-color-muted-foreground: var(--website-color-neutral-600);',
      '--website-radius-control: 8px;',
      '--website-radius-content: 12px;',
      '--website-control-default: 48px;',
      '--website-duration-standard: 240ms;',
      '--website-z-header: 50;',
      '--website-color-disabled-surface: var(--website-color-muted-surface);',
      '--website-color-disabled-surface: rgb(255 255 255 / 8%);',
      '--website-color-disabled-foreground: rgb(255 255 255 / 48%);',
      '--website-color-disabled-border: rgb(255 255 255 / 18%);',
    ])
      expect(css, declaration).toContain(declaration)

    const rootAliases = `
  --website-color-surface-foreground: var(--website-color-foreground);
  --website-color-muted: var(--website-color-muted-surface);
`
    const defaultTheme = css.match(/\[data-website-theme='default'\] \{([^}]+)\}/)?.[1]
    const inverseTheme = css.match(/\[data-website-theme='inverse'\] \{([^}]+)\}/)?.[1]

    expect(css, 'root compatibility aliases').toContain(rootAliases)
    expect(defaultTheme, 'default compatibility aliases').toContain(
      '--website-color-surface-foreground: var(--website-color-foreground);',
    )
    expect(defaultTheme).toContain('--website-color-muted: var(--website-color-muted-surface);')
    expect(inverseTheme, 'inverse compatibility aliases').toContain(
      '--website-color-surface-foreground: var(--website-color-foreground);',
    )
    expect(inverseTheme).toContain('--website-color-muted: var(--website-color-muted-surface);')
    expect(inverseTheme).toContain('--website-color-foreground: var(--website-color-brand-white);')
    expect(inverseTheme).toContain('--website-color-muted-surface: rgb(255 255 255 / 6%);')
  })
})
