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
  it('uses the shared section rhythm at the Block owner instead of duplicate my-16 margins', () => {
    const renderBlocks = readSource('src/blocks/RenderBlocks.tsx')
    const sources = shellFacingFiles.map(readSource)

    expect(renderBlocks).toContain('className="py-[var(--section-space-standard)]"')
    expect(sources.some((source) => source.includes('my-16'))).toBe(false)
  })

  it('uses site-container for ordinary shell-facing sections', () => {
    for (const file of [
      'src/blocks/Content/Component.tsx',
      'src/blocks/ArchiveBlock/Component.tsx',
      'src/components/CollectionArchive/index.tsx',
      'src/heros/LowImpact/index.tsx',
      'src/heros/MediumImpact/index.tsx',
      'src/app/(frontend)/posts/page.tsx',
      'src/app/(frontend)/posts/page/[pageNumber]/page.tsx',
      'src/app/(frontend)/search/page.tsx',
      'src/app/(frontend)/not-found.tsx',
    ]) {
      expect(readSource(file), file).toContain('site-container')
    }
  })

  it('uses reading-container for long-form post content and forms', () => {
    expect(readSource('src/blocks/Form/Component.tsx')).toContain('reading-container')
    expect(readSource('src/app/(frontend)/posts/[slug]/page.tsx')).toContain('reading-container')
  })

  it('preserves the existing MediumImpact media bleed through the wide container primitive', () => {
    const source = readSource('src/heros/MediumImpact/index.tsx')

    expect(source).toContain('wide-container')
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
