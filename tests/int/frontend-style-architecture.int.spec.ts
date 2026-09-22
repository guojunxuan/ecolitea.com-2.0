import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('frontend style architecture', () => {
  it('loads the focused frontend stylesheets in dependency order', () => {
    const source = read('src/app/(frontend)/globals.css')
    const imports = [
      "@import '../../styles/tokens.css';",
      "@import '../../styles/base.css';",
      "@import '../../styles/typography.css';",
      "@import '../../styles/content.css';",
      "@import '../../styles/layout.css';",
      "@import '../../styles/utilities.css';",
    ]

    let previousIndex = -1
    for (const statement of imports) {
      const index = source.indexOf(statement)
      expect(index, statement).toBeGreaterThan(previousIndex)
      previousIndex = index
    }
  })

  it('keeps every CSS import before other at-rules', () => {
    const source = read('src/app/(frontend)/globals.css')
    const atRules = [...source.matchAll(/@(\w[\w-]*)\b/g)].map((match) => match[1])
    const firstOtherRule = atRules.findIndex((name) => name !== 'import')

    expect(atRules.slice(firstOtherRule)).not.toContain('import')
  })

  it('owns compatibility tokens in the website namespace with only deprecated aliases', () => {
    const source = read('src/styles/tokens.css')
    const legacyAliases = [
      'site-max-width',
      'wide-max-width',
      'reading-max-width',
      'site-gutter',
      'section-space-compact',
      'section-space-standard',
      'section-space-spacious',
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'border',
      'input',
      'ring',
      'radius',
      'success',
      'warning',
      'error',
    ]
    for (const [, name, value] of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      if (name.startsWith('website-') || name === 'header-height') continue
      expect(legacyAliases, name).toContain(name)
      expect(value, name).toMatch(/^var\(--website-[\w-]+\)$/)
    }
    expect(source).toContain('--website-container-site: 76.25rem;')
    expect(source).toContain('--website-container-reading: 46rem;')
    expect(source).toContain('--website-gutter: clamp(2.5rem, 4vw, 3rem);')
    expect(source).toContain('--header-height: 3.75rem;')
    expect(source).toContain('--header-height: 4rem;')
    expect(source).toContain('--header-height: 4.5rem;')
    expect(source).toContain("[data-website-theme='inverse']")
    expect(source).not.toContain('[data-theme=')
  })

  it('keeps future content styles opt-in until the RichText consumer migrates', () => {
    const source = read('src/styles/content.css')
    expect(source).toContain('.payload-richtext--content')
    expect(source).toContain('.payload-richtext--plain')
    expect(source).toContain('.payload-richtext--wide')
    expect(source).not.toContain('--tw-prose-')
    expect(read('src/components/RichText/index.tsx')).not.toContain('payload-richtext--content')
  })

  it('keeps frontend and Payload global styles isolated', () => {
    expect(read('src/app/(frontend)/layout.tsx')).toContain("import './globals.css'")
    expect(read('src/app/(payload)/layout.tsx')).toContain("import './custom.css'")
    expect(read('src/app/(payload)/layout.tsx')).not.toContain('frontend/globals.css')
  })

  it('keeps the existing route groups as separate root layouts', () => {
    const frontend = read('src/app/(frontend)/layout.tsx')
    const payload = read('src/app/(payload)/layout.tsx')

    expect(frontend).toContain('<html')
    expect(frontend).toContain('<body')
    expect(payload).toContain('@payloadcms/next/layouts')
  })
})
