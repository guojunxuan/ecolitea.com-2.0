import fs from 'node:fs'
import path from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Providers } from '@/providers'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('public website shell', () => {
  it('renders the Header, main content landmark, and Footer without the admin or theme runtime', () => {
    const source = readSource('src/app/(frontend)/layout.tsx')

    const headerIndex = source.indexOf('<Header />')
    const mainIndex = source.indexOf('<main id="main-content">{children}</main>')
    const footerIndex = source.indexOf('<Footer />')

    expect(headerIndex).toBeGreaterThan(-1)
    expect(mainIndex).toBeGreaterThan(headerIndex)
    expect(footerIndex).toBeGreaterThan(mainIndex)
    expect(source).not.toContain('AdminBar')
    expect(source).not.toContain('InitTheme')
    expect(source).not.toContain('data-theme')
  })

  it('keeps Providers as a compatibility wrapper without mounting theme providers', () => {
    const source = readSource('src/providers/index.tsx')

    expect(source).not.toContain('ThemeProvider')
    expect(source).not.toContain('HeaderThemeProvider')

    const { container } = render(
      <Providers>
        <section aria-label="compatibility child">Unchanged child content</section>
      </Providers>,
    )

    const child = screen.getByRole('region', { name: 'compatibility child' })

    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(child)
    expect(child.textContent).toBe('Unchanged child content')
  })
})
