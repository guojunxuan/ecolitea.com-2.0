import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('public website shell', () => {
  it('renders the Header, main content landmark, and Footer without the admin or theme runtime', () => {
    const source = readSource('src/app/(frontend)/layout.tsx')

    expect(source).toContain('<Header />')
    expect(source).toContain('<main id="main-content">{children}</main>')
    expect(source).toContain('<Footer />')
    expect(source).not.toContain('AdminBar')
    expect(source).not.toContain('InitTheme')
    expect(source).not.toContain('data-theme')
  })

  it('keeps Providers as a compatibility wrapper without mounting theme providers', () => {
    const source = readSource('src/providers/index.tsx')

    expect(source).not.toContain('ThemeProvider')
    expect(source).not.toContain('HeaderThemeProvider')
  })
})
