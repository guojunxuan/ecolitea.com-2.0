import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const shellFacingFiles = [
  'src/blocks/RenderBlocks.tsx',
  'src/blocks/Content/Component.tsx',
  'src/blocks/ArchiveBlock/Component.tsx',
  'src/blocks/Form/Component.tsx',
  'src/components/CollectionArchive/index.tsx',
  'src/heros/LowImpact/index.tsx',
  'src/heros/MediumImpact/index.tsx',
  'src/heros/PostHero/index.tsx',
  'src/app/(frontend)/[slug]/page.tsx',
  'src/app/(frontend)/posts/page.tsx',
  'src/app/(frontend)/posts/page/[pageNumber]/page.tsx',
  'src/app/(frontend)/posts/[slug]/page.tsx',
  'src/app/(frontend)/search/page.tsx',
  'src/app/(frontend)/not-found.tsx',
]

describe('website layout primitives', () => {
  it('owns the approved responsive gutter and section spacing without token duplicates', () => {
    const layout = readSource('src/styles/layout.css')
    const tokens = readSource('src/styles/tokens.css')
    for (const step of [
      '--website-gutter: 16px;',
      '@media (width >= 40rem)',
      '--website-gutter: 24px;',
      '@media (width >= 48rem)',
      '--website-gutter: 32px;',
      '@media (width >= 73.125rem)',
      '--website-gutter: clamp(40px, 4vw, 48px);',
      '--website-section-compact: clamp(32px, 4vw, 48px);',
      '--website-section-standard: clamp(48px, 6vw, 80px);',
      '--website-section-spacious: clamp(72px, 9vw, 120px);',
      '--website-anchor-offset: calc(var(--header-height) + 24px);',
      'scroll-margin-block-start: var(--website-anchor-offset);',
    ])
      expect(layout, step).toContain(step)
    expect(tokens).not.toContain('--website-gutter:')
    expect(tokens).not.toContain('--website-section-')
    for (const width of ['46rem', '76.25rem', '90rem']) expect(tokens).toContain(width)
    expect(tokens).toContain('--header-height: 4.5rem;')
  })

  it('uses the shared section rhythm at the Block owner instead of duplicate my-16 margins', () => {
    const renderBlocks = readSource('src/blocks/RenderBlocks.tsx')
    const renderBlockStyles = readSource('src/blocks/RenderBlocks.module.css')
    const sources = shellFacingFiles.map(readSource)

    expect(renderBlocks).toContain('className={styles.section}')
    expect(renderBlockStyles).toContain('padding-block: var(--website-section-standard);')
    expect(sources.some((source) => source.includes('my-16'))).toBe(false)
  })

  it('uses module-backed site containers for Blocks and preserves shell container primitives', () => {
    expect(readSource('src/blocks/Content/Component.tsx')).toContain('styles.container')
    expect(readSource('src/blocks/ArchiveBlock/Component.tsx')).toContain('styles.intro')
    for (const file of [
      'src/blocks/Content/Component.module.css',
      'src/blocks/ArchiveBlock/Component.module.css',
    ]) {
      expect(readSource(file), file).toContain('var(--website-container-site)')
    }
    for (const file of [
      'src/heros/LowImpact/index.module.css',
      'src/heros/MediumImpact/index.module.css',
    ]) {
      expect(readSource(file), file).toContain('var(--website-container-site)')
    }
  })

  it('uses semantic CSS Module slots for shared archives and public page shells', () => {
    const archive = readSource('src/components/CollectionArchive/index.tsx')
    const pageRange = readSource('src/components/PageRange/index.tsx')
    const pagination = readSource('src/components/Pagination/index.tsx')
    const search = readSource('src/search/Component.tsx')
    const pages = [
      'src/app/(frontend)/posts/page.tsx',
      'src/app/(frontend)/posts/page/[pageNumber]/page.tsx',
      'src/app/(frontend)/posts/[slug]/page.tsx',
      'src/app/(frontend)/search/page.tsx',
      'src/app/(frontend)/not-found.tsx',
    ].map(readSource)

    expect(archive).toContain('styles.archive')
    expect(archive).toContain('styles.grid')
    expect(archive).toContain('styles.card')
    expect(pageRange).toContain('styles.range')
    expect(pagination).toContain('styles.pagination')
    expect(search).toContain('styles.form')
    expect(search).toContain('styles.visuallyHidden')
    expect(pages.some((source) => source.includes('styles.pageSection'))).toBe(true)
    expect(pages.some((source) => source.includes('styles.pageHeader'))).toBe(true)
    expect(pages.some((source) => source.includes('styles.pageHeaderCentered'))).toBe(true)
    expect(pages.some((source) => source.includes('styles.searchField'))).toBe(true)
    expect(pages.some((source) => source.includes('styles.postContent'))).toBe(true)
    expect(pages.some((source) => source.includes('styles.notFound'))).toBe(true)
  })

  it('keeps shared layout values in module properties instead of utility strings', () => {
    const archiveStyles = readSource('src/components/CollectionArchive/index.module.css')
    const pageStyles = readSource('src/app/(frontend)/pages.module.css')

    expect(archiveStyles).toContain('var(--website-container-site)')
    expect(archiveStyles).toContain('grid-template-columns: repeat(4, minmax(0, 1fr));')
    expect(archiveStyles).toMatch(
      /@media \(width >= 40rem\)[\s\S]*grid-template-columns: repeat\(8, minmax\(0, 1fr\)\);/,
    )
    expect(archiveStyles).toMatch(
      /@media \(width >= 64rem\)[\s\S]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\);/,
    )
    expect(pageStyles).toContain('var(--website-section-spacious)')
    expect(pageStyles).toContain('var(--website-container-reading)')
    expect(pageStyles).toContain('var(--website-space-16)')
    expect(pageStyles).toContain('composes: website-type-heading-large from global;')
    expect(pageStyles).not.toMatch(
      /@media \(width >= 48rem\)[\s\S]*\.(?:pageHeader|pageHeaderCentered|notFound) h1[\s\S]*font-size:\s*3\.5rem;/,
    )
  })

  it('uses the reading container contract for long-form post content and forms', () => {
    expect(readSource('src/blocks/Form/Component.tsx')).toContain('styles.container')
    expect(readSource('src/blocks/Form/Component.module.css')).toContain(
      'var(--website-container-reading)',
    )
    expect(readSource('src/app/(frontend)/posts/[slug]/page.tsx')).toContain('styles.postContent')
  })

  it('preserves the existing MediumImpact media bleed through the wide container primitive', () => {
    const source = readSource('src/heros/MediumImpact/index.module.css')

    expect(source).toContain('var(--website-container-wide)')
    expect(source).not.toMatch(/-mx-/)
  })

  it('does not introduce a second fixed-header offset or negative header overlap', () => {
    const violations = shellFacingFiles.flatMap((file) => {
      const source = readSource(file)
      return [
        /(?:pt|mt)-\[var\(--header-height\)\]/,
        /(?:-mt|-top)-\[var\(--header-height\)\]/,
        /calc\([^)]*--header-height/,
        /(?:^|\s)-(?:mt|top)-\[[^\]]+\]/m,
      ]
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${file}: ${pattern.source}`)
    })

    expect(violations).toEqual([])
  })
})
