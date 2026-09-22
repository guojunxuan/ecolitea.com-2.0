import fs from 'node:fs'
import path from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Providers } from '@/providers'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const readSourceTree = (relativePath: string): Array<{ file: string; source: string }> => {
  const absolutePath = path.join(process.cwd(), relativePath)

  return fs.statSync(absolutePath).isDirectory()
    ? fs
        .readdirSync(absolutePath)
        .flatMap((entry) => readSourceTree(path.join(relativePath, entry)))
    : [{ file: relativePath, source: fs.readFileSync(absolutePath, 'utf8') }]
}

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

  it('mounts the HeaderThemeProvider around public content', () => {
    const source = readSource('src/providers/index.tsx')

    expect(source).toContain('HeaderThemeProvider')

    const { container } = render(
      <Providers>
        <section aria-label="compatibility child">Unchanged child content</section>
      </Providers>,
    )

    const child = screen.getByRole('region', { name: 'compatibility child' })

    expect(container.children).toHaveLength(1)
    expect(container.querySelector('[aria-label="compatibility child"]')).toBe(child)
    expect(child.textContent).toBe('Unchanged child content')
  })

  it('keeps public website source free of the removed global theme runtime', () => {
    const sourceFiles = [
      'src/app/(frontend)',
      'src/Header',
      'src/Footer',
      'src/heros',
      'src/components',
      'src/providers',
    ].flatMap(readSourceTree)
    const forbiddenReferences = ['ThemeSelector', 'dark:', 'dark:prose-invert']

    const violations = sourceFiles.flatMap(({ file, source }) => {
      const sourceWithoutAllowedPrismTheme = source.replaceAll('themes.vsDark', '')

      return forbiddenReferences
        .filter((reference) => sourceWithoutAllowedPrismTheme.includes(reference))
        .map((reference) => `${file}: ${reference}`)
    })

    expect(violations).toEqual([])
    expect(fs.existsSync(path.join(process.cwd(), 'src/providers/Theme'))).toBe(false)
    expect(fs.existsSync(path.join(process.cwd(), 'src/providers/HeaderTheme'))).toBe(true)
  })

  it('keeps HighImpact readable on its fixed dark surface without theme state', () => {
    const source = readSource('src/heros/HighImpact/index.tsx')

    expect(source).toContain('bg-black')
    expect(source).toContain('text-white')
    expect(source).toContain('className="mb-6 prose-invert"')
  })

  it('defines the shared responsive layout tokens and containers', () => {
    const tokens = readSource('src/styles/tokens.css')
    const layout = readSource('src/styles/layout.css')

    expect(tokens).toContain('--website-container-site: 76.25rem;')
    expect(tokens).toContain('--website-container-reading: 46rem;')
    expect(tokens).toContain('--header-height: 3.75rem;')
    expect(tokens).toMatch(/@media \(width >= 73\.125rem\)[\s\S]*--header-height:\s*4\.5rem;/)
    expect(tokens).toContain('--website-section-compact: clamp(2rem, 4vw, 3rem);')
    expect(tokens).toContain('--website-section-standard: clamp(3rem, 6vw, 5rem);')
    expect(tokens).toContain('--website-section-spacious: clamp(4.5rem, 9vw, 7.5rem);')
    expect(tokens).toContain('@media (width >= 73.125rem)')

    expect(layout).toMatch(
      /\.site-container[^}]*{[^}]*width:\s*min\(100% - \(2 \* var\(--website-gutter\)\), var\(--website-container-max\)\);[^}]*margin-inline:\s*auto;/s,
    )
    expect(layout).toContain('--website-container-max: var(--website-container-wide);')
    expect(layout).toContain('--website-container-max: var(--website-container-reading);')

    expect(tokens).not.toContain("[data-theme='dark']")
    expect(tokens).not.toMatch(/@custom-variant\s+dark\b/)
    expect(tokens).not.toMatch(/html[^{}]*{[^}]*opacity\s*:/s)
  })
})
