import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('global visual foundation', () => {
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
