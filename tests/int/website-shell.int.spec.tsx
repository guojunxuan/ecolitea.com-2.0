import fs from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/Link', () => ({ CMSLink: () => null }))
vi.mock('@/components/RichText', () => ({ default: () => null }))
vi.mock('@/components/Media', () => ({ Media: () => null }))

import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import { HighImpactHero } from '@/heros/HighImpact'
import { LowImpactHero } from '@/heros/LowImpact'
import { MediumImpactHero } from '@/heros/MediumImpact'
import { PostHero } from '@/heros/PostHero'
import { Providers } from '@/providers'
import { useHeaderTheme } from '@/providers/HeaderTheme'

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

const ThemeProbe = () => {
  const { headerTheme } = useHeaderTheme()
  return <output data-testid="active-header-theme">{headerTheme ?? 'reset'}</output>
}

const heroDirectories = ['HighImpact', 'LowImpact', 'MediumImpact', 'PostHero'] as const

const HeroModules = () => (
  <>
    <HighImpactHero headerTheme="dark" type="highImpact" />
    <LowImpactHero headerTheme="light">Low content</LowImpactHero>
    <MediumImpactHero headerTheme="light" type="mediumImpact" />
    <PostHero post={{ categories: [], title: 'Post title' } as never} />
  </>
)

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
    const source = readSource('src/heros/HighImpact/index.module.css')
    const markup = readSource('src/heros/HighImpact/index.tsx')

    expect(markup).toContain('data-website-theme="inverse"')
    expect(source).toContain('background-color: var(--website-color-background);')
    expect(source).toContain('color: var(--website-color-foreground);')
    expect(source).toContain('var(--website-scrim-strong)')
    expect(markup).toContain('payload-richtext--inverse')
    expect(markup).not.toContain('prose-invert')
  })

  it('updates and resets Header theme across Hero changes and unmount', () => {
    const { rerender } = render(
      <Providers>
        <ThemeProbe />
        <HeaderThemeSync theme="dark" />
      </Providers>,
    )
    expect(screen.getByTestId('active-header-theme').textContent).toBe('dark')
    expect(document.querySelector('[data-header-theme]')?.getAttribute('data-header-theme')).toBe(
      'dark',
    )

    rerender(
      <Providers>
        <ThemeProbe />
        <HeaderThemeSync theme="light" />
      </Providers>,
    )
    expect(screen.getByTestId('active-header-theme').textContent).toBe('light')

    rerender(
      <Providers>
        <ThemeProbe />
      </Providers>,
    )
    expect(screen.getByTestId('active-header-theme').textContent).toBe('reset')
    cleanup()
  })

  it('keeps all Hero markup on semantic module slots', () => {
    const { container } = render(<HeroModules />)
    for (const slot of ['high-impact', 'low-impact', 'medium-impact', 'post']) {
      expect(container.querySelector(`[data-hero="${slot}"]`)).not.toBeNull()
    }
    for (const directory of heroDirectories) {
      const source = readSource(`src/heros/${directory}/index.tsx`)
      expect(source).toContain("import styles from './index.module.css'")
      expect(source).not.toMatch(/className="[^"]*"/)
    }
  })

  it('preserves Hero composition, breakpoints, and overlay geometry in colocated CSS', () => {
    const high = readSource('src/heros/HighImpact/index.module.css')
    const low = readSource('src/heros/LowImpact/index.module.css')
    const medium = readSource('src/heros/MediumImpact/index.module.css')
    const post = readSource('src/heros/PostHero/index.module.css')

    expect(high).toContain('max-width: 36.5rem;')
    expect(high).toContain('min-height: 80vh;')
    expect(high).toMatch(/@media \(width >= 48rem\)[\s\S]*text-align:\s*center;/)
    expect(low).toContain('max-width: 48rem;')
    expect(low).toContain('padding-top: var(--website-section-standard);')
    expect(medium).toContain('padding-top: var(--website-section-standard);')
    expect(medium).toContain('var(--website-container-wide)')
    expect(post).toContain('grid-template-columns: 1fr 48rem 1fr;')
    expect(post).toContain('min-height: 80vh;')
    expect(post).toMatch(
      /\.overlay\s*{[^}]*height:\s*50%;[^}]*linear-gradient\(to top, rgb\(0 0 0 \/ var\(--website-scrim-strong\)\), transparent\)/s,
    )
    expect(post).toMatch(/@media \(width >= 48rem\)[\s\S]*font-size:\s*3rem;/)
    expect(post).toMatch(/@media \(width >= 64rem\)[\s\S]*font-size:\s*3\.75rem;/)
  })

  it('keeps inverse ownership on dark content and local foreground adaptation on the Header', () => {
    expect(readSource('src/heros/PostHero/index.tsx')).toContain('data-website-theme="inverse"')
    expect(readSource('src/blocks/Code/Component.client.tsx')).toContain(
      'data-website-theme="inverse"',
    )
    const header = readSource('src/Header/Component.client.tsx')
    expect(header).toContain('data-theme={headerTheme')
    expect(header).not.toContain('data-website-theme')
  })

  it('uses named shell layers and a supported Glass fallback', () => {
    const header = readSource('src/Header/Component.module.css')
    const navigation = readSource('src/Header/Nav/index.module.css')
    expect(header).toContain('z-index: var(--website-z-header)')
    expect(navigation).toContain('z-index: var(--website-z-dropdown)')
    expect(navigation).toContain('z-index: var(--website-z-overlay)')
    expect(header).toContain('background: var(--website-glass-surface)')
    expect(header).toContain('border-bottom: 1px solid var(--website-glass-border)')
    expect(header).toContain('box-shadow: var(--website-shadow-subtle)')
    expect(header).toContain(
      'backdrop-filter: blur(var(--website-glass-blur)) saturate(var(--website-glass-saturation))',
    )
    expect(header).toContain('@supports not (backdrop-filter: blur(1px))')
    expect(header).toContain('@media (width <= 1170px)')
    expect(`${header}\n${navigation}`).not.toMatch(/z-index:\s*(?:999|9999)\b/)
  })

  it('uses semantic inverse surfaces for Footer and Code without changing Prism scope', () => {
    const footer = readSource('src/Footer/index.module.css')
    const code = readSource('src/blocks/Code/Component.module.css')
    expect(footer).toContain('var(--website-color-muted-foreground)')
    expect(footer).toContain('var(--website-color-border)')
    expect(footer).toContain('var(--website-color-disabled-foreground)')
    expect(footer).not.toMatch(/rgb\(255 255 255 \/ \d+%\)/)
    expect(footer).toContain('@media (prefers-reduced-motion: reduce)')
    expect(footer).toContain(".navigation[data-enhanced='true'] .linkPanel")
    expect(code).toContain('background-color: var(--website-color-background)')
    expect(code).toContain('color: var(--website-color-foreground)')
    expect(code).toContain('font-size: 0.875rem')
    expect(code).toContain('line-height: 1.375rem')
    expect(readSource('src/blocks/Code/Component.client.tsx')).toContain('themes.vsDark')
  })

  it('keeps image overlay coverage local to Heroes and visual navigation cards', () => {
    const high = readSource('src/heros/HighImpact/index.module.css')
    const post = readSource('src/heros/PostHero/index.module.css')
    const card = readSource('src/Header/Nav/blocks.module.css')
    const markup = readSource('src/Header/Nav/NavigationCard.tsx')
    expect(high).toContain('var(--website-scrim-strong)')
    expect(post).toContain('height: 50%')
    expect(card).toContain('var(--website-scrim-strong)')
    expect(card).toContain('inset: 65% 0 0')
    expect(markup).toContain("variant === 'visual' ? 'inverse' : undefined")
  })

  it('defines the shared responsive layout tokens and containers', () => {
    const tokens = readSource('src/styles/tokens.css')
    const layout = readSource('src/styles/layout.css')

    expect(tokens).toContain('--website-container-site: 76.25rem;')
    expect(tokens).toContain('--website-container-reading: 46rem;')
    expect(tokens).toContain('--header-height: 3.75rem;')
    expect(tokens).toMatch(/@media \(width >= 73\.125rem\)[\s\S]*--header-height:\s*4\.5rem;/)
    expect(layout).toContain('--website-section-compact: clamp(32px, 4vw, 48px);')
    expect(layout).toContain('--website-section-standard: clamp(48px, 6vw, 80px);')
    expect(layout).toContain('--website-section-spacious: clamp(72px, 9vw, 120px);')
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
