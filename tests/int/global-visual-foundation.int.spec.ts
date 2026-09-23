import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('global visual foundation', () => {
  it('defines the approved target primitives and semantic schemes', () => {
    const css = read('src/styles/tokens.css')
    for (const declaration of [
      '--website-color-brand-black: #0a0a0a;',
      '--website-color-foreground: #262629;',
      '--website-color-muted-foreground: #76767f;',
      '--website-radius-control: 8px;',
      '--website-radius-content: 12px;',
      '--website-control-default: 48px;',
      '--website-duration-standard: 240ms;',
      '--website-z-header: 50;',
      '--website-color-disabled-surface: var(--website-color-muted-surface);',
    ])
      expect(css, declaration).toContain(declaration)
    expect(css).toContain("[data-website-theme='default']")
    expect(css).toContain("[data-website-theme='inverse']")
    expect(css).toContain('--website-color-disabled-surface: rgb(255 255 255 / 8%);')
    expect(css).toContain('--website-color-disabled-foreground: rgb(255 255 255 / 48%);')
    expect(css).toContain('--website-color-disabled-border: rgb(255 255 255 / 18%);')
  })
})
