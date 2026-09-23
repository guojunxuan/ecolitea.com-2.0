import fs from 'node:fs'
import path from 'node:path'

import postcss, { type AtRule, type Rule } from 'postcss'
import { describe, expect, it } from 'vitest'

import { scanShellClasses, scanShellCss } from '../helpers/shellStyleAudit'

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const listFiles = (relativePath: string, suffix: string): string[] =>
  fs.statSync(path.join(process.cwd(), relativePath)).isDirectory()
    ? fs
        .readdirSync(path.join(process.cwd(), relativePath))
        .flatMap((entry) => listFiles(path.join(relativePath, entry), suffix))
    : relativePath.endsWith(suffix)
      ? [relativePath]
      : []

const shellFiles = (suffix: string) =>
  ['src/Header', 'src/Footer'].flatMap((directory) => listFiles(directory, suffix))

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
    const files = shellFiles('.module.css')
    const tokens = read('src/styles/tokens.css')
    const violations = files.flatMap((file) => scanShellCss(file, read(file), tokens))

    expect(violations).toEqual([])
    expect(read('src/Header/Component.module.css')).toContain('260ms ease')
    expect(read('src/Header/Nav/index.module.css')).toContain('(width > 1170px)')
    expect(read('src/Footer/index.module.css')).toContain(
      'grid-template-columns: minmax(0, 20fr) minmax(0, 55fr) minmax(0, 25fr)',
    )
    expect(read('src/Footer/index.module.css')).toContain('180ms ease')
    expect(read('src/Footer/index.module.css')).toContain('200ms ease')
  })

  it('keeps owned Header and Footer TSX free of Tailwind utilities', async () => {
    const files = shellFiles('.tsx')
    const violations = (
      await Promise.all(files.map((file) => scanShellClasses(file, read(file))))
    ).flat()

    expect(violations).toEqual([])
  })

  it('detects equivalent inverse colors, radii, durations, and shared shadows', () => {
    const tokens = `${read('src/styles/tokens.css')}\n:root { --website-shadow-card: 0 1px 2px rgb(0 0 0 / 10%); }`
    const footer = scanShellCss(
      'src/Footer/test.module.css',
      `
      .example {
        background: rgb(10, 10, 10);
        color: rgba(255, 255, 255, .65);
        border-block-color: rgba(255, 255, 255, .18);
        border-radius: .625rem;
        transition: opacity .16s ease;
        box-shadow: 0 1px 2px rgba(0, 0, 0, .1);
      }
      .strong { color: white; border-radius: 999.0px; transition: opacity .36s ease; }
    `,
      tokens,
    )
    const header = scanShellCss(
      'src/Header/test.module.css',
      `
      .example {
        background: rgb(255 255 255);
        color: oklch(14.5% 0 0deg);
        border-radius: 0.8rem;
        transition-duration: 0.36s;
      }
      .shorthand { background: white no-repeat; }
      .gradient { background: linear-gradient(white, transparent); }
    `,
      tokens,
    )

    expect(footer).toEqual(
      expect.arrayContaining([
        expect.stringContaining('inverse background'),
        expect.stringContaining('inverse muted foreground'),
        expect.stringContaining('inverse foreground'),
        expect.stringContaining('inverse border'),
        expect.stringContaining('control radius'),
        expect.stringContaining('pill radius'),
        expect.stringContaining('fast duration'),
        expect.stringContaining('slow duration'),
        expect.stringContaining('shared shadow'),
      ]),
    )
    expect(header).toEqual(
      expect.arrayContaining([
        expect.stringContaining('default background'),
        expect.stringContaining('default foreground'),
        expect.stringContaining('content radius'),
        expect.stringContaining('slow duration'),
      ]),
    )
    expect(header.filter((violation) => violation.includes('default background'))).toHaveLength(2)
  })

  it('allows documented local Header and Footer values', () => {
    const tokens = read('src/styles/tokens.css')
    expect(
      scanShellCss(
        'src/Header/test.module.css',
        `
      @media (width < 1170px) {
        .brand { transition: opacity 260ms ease; border-radius: .5rem; box-shadow: 0 1px 2px rgb(0 0 0 / 7%); }
      }
    `,
        tokens,
      ),
    ).toEqual([])
    expect(
      scanShellCss(
        'src/Footer/test.module.css',
        `
      .footer { grid-template-columns: minmax(0, 20fr) minmax(0, 55fr) minmax(0, 25fr); transition: opacity 180ms ease, transform .2s ease; border-radius: 50%; color: rgb(255 255 255 / 72%); }
      .unique { border-color: #ffffff2e; border-radius: 10px; }
    `,
        tokens,
      ),
    ).toEqual([])
  })

  it('detects Tailwind utilities across JSX class expressions and permits project hooks', async () => {
    const source = `
      const utility = 'shrink-0'
      const View = ({ active }) => <>
        <div className="site-container custom-hook flex" />
        <div className={'bg-black'} />
        <div className={\`site-container \${active ? 'mt-auto' : ''}\`} />
        <div className={clsx(styles.root, active && 'text-white', ['font-semibold'])} />
        <div className={cn({ 'max-[1170px]:hidden': active })} />
        <div className={clsx('group', 'peer', 'group/menu', 'peer/input', 'aspect-video', 'object-cover', 'animate-spin', 'ring-2', 'size-4', 'md:flex', 'hover:bg-black', 'group-hover:opacity-50', 'peer-checked:block', 'w-[37px]', '[color:red]', 'bg-card', 'prose', 'not-prose')} />
        <div className={utility} data-hook="custom-hook" />
      </>
    `
    const detected = (await scanShellClasses('test.tsx', source)).map((violation) =>
      violation.split(': ').at(-1),
    )
    expect(detected).toEqual(
      expect.arrayContaining([
        'flex',
        'bg-black',
        'mt-auto',
        'text-white',
        'font-semibold',
        'max-[1170px]:hidden',
        'shrink-0',
        'group',
        'peer',
        'group/menu',
        'peer/input',
        'aspect-video',
        'object-cover',
        'animate-spin',
        'ring-2',
        'size-4',
        'md:flex',
        'hover:bg-black',
        'group-hover:opacity-50',
        'peer-checked:block',
        'w-[37px]',
        '[color:red]',
        'bg-card',
        'prose',
        'not-prose',
      ]),
    )
    expect(
      await scanShellClasses(
        'test.tsx',
        '<div className="site-container custom-hook" data-hook="bg-black" />',
      ),
    ).toEqual([])
  })

  it('detects utilities from the frontend animation stylesheet import', async () => {
    const source = `
      <div className={clsx('animate-in fade-in-0 slide-in-from-top-4',
        active && 'animation-duration-300 zoom-out-95',
        ['hover:slide-in-from-right-2', 'md:animate-out'])} />
    `
    const detected = (await scanShellClasses('test.tsx', source)).map((violation) =>
      violation.split(': ').at(-1),
    )

    expect(detected).toEqual([
      'animate-in',
      'fade-in-0',
      'slide-in-from-top-4',
      'animation-duration-300',
      'zoom-out-95',
      'hover:slide-in-from-right-2',
      'md:animate-out',
    ])
  })
})
