import fs from 'node:fs'
import path from 'node:path'

import postcss, { type AtRule, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const isRuleOrAtRule = (node: unknown): node is AtRule | Rule =>
  typeof node === 'object' &&
  node !== null &&
  'type' in node &&
  (node.type === 'rule' || node.type === 'atrule')

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

  it('gates every content rule behind the explicit RichText content mode', () => {
    const source = read('src/styles/content.css')
    const root = postcss.parse(source)
    const ungatedRules: string[] = []

    root.walkRules((rule) => {
      let current: AtRule | Rule | undefined = rule
      let isGated = false

      while (current) {
        if (
          (current.type === 'rule' && current.selector.includes('.payload-richtext--content')) ||
          (current.type === 'atrule' &&
            current.name === 'scope' &&
            current.params.includes('.payload-richtext--content'))
        ) {
          isGated = true
          break
        }

        current = isRuleOrAtRule(current.parent) ? current.parent : undefined
      }

      if (!isGated) ungatedRules.push(rule.selector)
    })

    expect(ungatedRules).toEqual([])
    expect(source).toContain('.payload-richtext--content')
    expect(source).toMatch(
      /@scope\s*\(\.payload-richtext\.payload-richtext--content\)\s*to\s*\(\.payload-richtext__embedded\)/,
    )
    expect(source).toContain('.payload-richtext__embedded')
    expect(source).not.toContain('--tw-prose-')
    expect(source).not.toContain('--payload-richtext-')
    expect(source).toContain('--website-richtext-')
    expect(source).not.toContain('.not-prose')
    expect(read('src/components/RichText/index.tsx')).toContain('payload-richtext--content')
    expect(read('src/components/RichText/index.tsx')).toContain('payload-richtext--plain')
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

  it('keeps Header and Footer on exact website tokens while retaining local geometry', () => {
    const files = [
      'src/Header/Component.module.css',
      'src/Header/Nav/index.module.css',
      'src/Header/Nav/blocks.module.css',
      'src/Footer/index.module.css',
    ]
    const violations: string[] = []

    for (const file of files) {
      const isFooter = file.startsWith('src/Footer/')
      postcss.parse(read(file), { from: file }).walkDecls((decl) => {
        const value = decl.value.trim()
        const normalized = value.replace(/\s+/g, ' ')
        if (
          /var\(--(?:foreground|background|border|muted|muted-foreground|primary|primary-foreground|site-gutter)\)/.test(
            value,
          )
        ) {
          violations.push(`${file}: deprecated token in ${decl.prop}`)
        }
        if (decl.prop === 'border-radius' && value === '999px') {
          violations.push(`${file}: raw pill radius`)
        }
        if (/\b(?:160|360)ms\b/.test(value)) {
          violations.push(`${file}: raw shared duration in ${decl.prop}`)
        }
        if (
          isFooter &&
          ((decl.prop === 'background' && value === '#0a0a0a') ||
            (decl.prop === 'color' && value === '#fff') ||
            (decl.prop === 'color' && normalized === 'rgb(255 255 255 / 65%)') ||
            (/^border(?:-(?:top|bottom))?$/.test(decl.prop) &&
              normalized === '1px solid rgb(255 255 255 / 18%)'))
        ) {
          violations.push(`${file}: raw inverse ${decl.prop}`)
        }
      })
    }

    expect(violations).toEqual([])
    expect(read('src/Header/Component.module.css')).toContain('260ms ease')
    expect(read('src/Header/Nav/index.module.css')).toContain('(width > 1170px)')
    expect(read('src/Footer/index.module.css')).toContain(
      'grid-template-columns: minmax(0, 20fr) minmax(0, 55fr) minmax(0, 25fr)',
    )
    expect(read('src/Footer/index.module.css')).toContain('180ms ease')
    expect(read('src/Footer/index.module.css')).toContain('200ms ease')
  })

  it('keeps owned Header and Footer TSX free of Tailwind utilities', () => {
    const files = ['src/Header', 'src/Footer'].flatMap((directory) => {
      const walk = (relativePath: string): string[] =>
        fs.statSync(path.join(process.cwd(), relativePath)).isDirectory()
          ? fs
              .readdirSync(path.join(process.cwd(), relativePath))
              .flatMap((entry) => walk(path.join(relativePath, entry)))
          : relativePath.endsWith('.tsx')
            ? [relativePath]
            : []
      return walk(directory)
    })
    const violations = files.flatMap((file) =>
      [...read(file).matchAll(/className="([^"]+)"/g)]
        .filter((match) => match[1] !== 'site-container')
        .map((match) => `${file}: ${match[1]}`),
    )

    expect(violations).toEqual([])
  })
})
