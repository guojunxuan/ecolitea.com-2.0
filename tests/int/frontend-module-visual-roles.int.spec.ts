import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { auditCss } from '../helpers/cssAudit'

const root = process.cwd()
const moduleRoots = [
  'src/components',
  'src/blocks',
  'src/search',
  'src/app/(frontend)',
  'src/Header',
  'src/Footer',
  'src/heros',
]

const cssModules = (directory: string): string[] =>
  fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(directory, entry.name)
    if (entry.isDirectory()) return cssModules(file)
    return entry.name.endsWith('.module.css') ? [file] : []
  })

const declarations = (file: string) =>
  auditCss(fs.readFileSync(path.join(root, file), 'utf8')).declarations

describe('frontend module visual roles', () => {
  it('reports each duplicated system value by file, line and value', () => {
    const violations = moduleRoots.flatMap(cssModules).flatMap((file) =>
      declarations(file).flatMap(({ prop, value, line }) => {
        // Modules own Scrim coverage/direction while the approved opacity remains token-driven.
        const tokenizedScrim = /rgb\(0 0 0 \/ var\(--website-scrim-(?:subtle|standard|strong)\)\)/.test(
          value,
        )
        const rawColor =
          (!tokenizedScrim && /(?:#[\da-f]{3,8}\b|\brgba?\(|\boklch\()/i.test(value)) ||
          /^(?:white|black)$/i.test(value)
        const rawRadius =
          prop === 'border-radius' &&
          /(?:^|\s)(?:0?\.25|0?\.5|0?\.75|1)rem\b|\b(?:4|8|12|16|999)px\b/.test(value)
        const rawDuration = /\b(?:160|240|360)ms\b/.test(value)
        const rawControl =
          /^(?:width|min-width|height|min-height)$/.test(prop) && /\b(?:44|48|56)px\b/.test(value)
        const rawLayer = prop === 'z-index' && /^(?:0|10|20|50|60|70|80|90)$/.test(value)
        return rawColor || rawRadius || rawDuration || rawControl || rawLayer
          ? [`${file}:${line} ${prop}: ${value}`]
          : []
      }),
    )
    expect(violations).toEqual([])
  })

  it('maps content shapes and status banners to the shared visual roles', () => {
    for (const [file, selector, role] of [
      ['src/components/Card/index.module.css', '.card', 'content'],
      ['src/components/ui/card.module.css', '.card', 'content'],
      ['src/blocks/Code/Component.module.css', '.code', 'content'],
      ['src/blocks/CallToAction/Component.module.css', '.panel', 'panel'],
      ['src/blocks/Form/Component.module.css', '.panel', 'panel'],
    ]) {
      const radius = declarations(file).find(
        (entry) => entry.header === selector && entry.prop === 'border-radius',
      )
      expect(radius?.value, `${file} ${selector}`).toBe(`var(--website-radius-${role})`)
    }

    const card = declarations('src/components/ui/card.module.css').filter(
      (entry) => entry.header === '.card',
    )
    expect(card.some((entry) => entry.prop === 'box-shadow')).toBe(false)

    const banner = declarations('src/blocks/Banner/Component.module.css')
    expect(
      banner.find((entry) => entry.header === '.surface' && entry.prop === 'border-left-width')
        ?.value,
    ).toBe('2px')
    for (const status of ['info', 'warning', 'error', 'success']) {
      for (const [prop, role] of [
        ['border-left-color', 'accent'],
        ['border-color', 'border'],
        ['background-color', 'background'],
        ['color', 'foreground'],
      ]) {
        expect(
          banner.find((entry) => entry.header === `.${status}` && entry.prop === prop)?.value,
          `${status} ${prop}`,
        ).toBe(`var(--website-status-${status}-${role})`)
      }
    }
  })

  it('retires temporary color aliases after every consumer migrates', () => {
    const aliases = /--website-color-(?:surface-foreground|muted)(?!-(?:foreground|surface))\b/
    const consumers = [
      ...moduleRoots.flatMap(cssModules),
      'src/Header/Nav/blocks.module.css',
    ].filter((file) => aliases.test(fs.readFileSync(path.join(root, file), 'utf8')))
    expect(consumers).toEqual([])
    expect(fs.readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8')).not.toMatch(aliases)
  })

  it('assigns shared type roles while keeping heading levels in the existing markup', () => {
    for (const [file, selector, role] of [
      ['src/blocks/Code/Component.module.css', '.code', 'code'],
      ['src/components/Card/index.module.css', '.categoryLabel', 'body-small'],
      ['src/components/Card/index.module.css', '.heading', 'heading-small'],
      ['src/components/ui/card.module.css', '.title', 'heading-medium'],
      ['src/components/ui/card.module.css', '.description', 'body-small'],
      ['src/components/PageRange/index.module.css', '.range', 'body-small'],
      ['src/components/Card/index.module.css', '.description', 'body'],
      ['src/app/(frontend)/pages.module.css', '.pageTitle', 'heading-large'],
    ]) {
      const typeClass = declarations(file).find(
        (entry) => entry.header === selector && entry.prop === 'composes',
      )
      expect(typeClass?.value, `${file} ${selector}`).toBe(`website-type-${role} from global`)
    }
    expect(fs.readFileSync(path.join(root, 'src/components/Card/index.tsx'), 'utf8')).toContain(
      '<h3 className={styles.heading}>',
    )
    for (const file of [
      'src/app/(frontend)/posts/page.tsx',
      'src/app/(frontend)/posts/page/[pageNumber]/page.tsx',
      'src/app/(frontend)/search/page.tsx',
      'src/app/(frontend)/not-found.tsx',
    ])
      expect(fs.readFileSync(path.join(root, file), 'utf8'), file).toContain(
        '<h1 className={styles.pageTitle}>',
      )
  })

  it('uses the common spacing rhythm for ordinary card internals', () => {
    const card = declarations('src/components/ui/card.module.css')
    expect(card.find((entry) => entry.header === '.header' && entry.prop === 'gap')?.value).toBe(
      'var(--website-space-2)',
    )
  })

  it('reuses the global visually-hidden utility for form, search and pagination labels', () => {
    const scoped = [
      ...cssModules('src/blocks/Form').filter((file) => file.endsWith('/index.module.css')),
      'src/search/Component.module.css',
      'src/components/ui/pagination.module.css',
    ]
    for (const file of scoped) {
      const hidden = declarations(file).filter((entry) =>
        ['.requiredText', '.visuallyHidden', '.screenReaderOnly'].includes(entry.header),
      )
      if (!hidden.length) continue
      expect(
        hidden.find((entry) => entry.prop === 'composes')?.value,
        `${file} uses the shared accessible hiding rule`,
      ).toBe('visually-hidden from global')
      expect(
        hidden.some((entry) => entry.prop === 'clip'),
        file,
      ).toBe(false)
    }
  })

  it('drops the legacy 86rem cap where the owning site container is narrower', () => {
    for (const file of [
      'src/blocks/CallToAction/Component.module.css',
      'src/blocks/MediaBlock/Component.module.css',
      'src/blocks/RelatedPosts/Component.module.css',
      'src/components/RichText/index.module.css',
    ])
      expect(fs.readFileSync(path.join(root, file), 'utf8'), file).not.toContain('86rem')
  })
})
