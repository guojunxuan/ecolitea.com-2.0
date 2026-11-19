import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

function layeredCssFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return layeredCssFiles(filename)
    if (!filename.endsWith('.css')) return []
    return /@layer\s+(?:base|components|utilities)\s*\{/.test(read(filename)) ? [filename] : []
  })
}

describe('global visual foundation', () => {
  it('establishes the cascade layer order before any layered frontend rule', () => {
    for (const file of layeredCssFiles('src')) {
      const css = read(file)
      const firstLayer = css.indexOf('@layer')
      expect(
        css.slice(firstLayer).startsWith('@layer base, components, utilities;'),
        `${file} must declare the layer order before its first layered rule`,
      ).toBe(true)
    }
  })

  it('defines the approved Inter roles and responsive title steps', () => {
    const css = read('src/styles/typography.css')
    const rules = auditCss(css)
    const expected = {
      'display-1': ['56px', '1', '600', '-0.04em'],
      'display-2': ['44px', '1', '600', '-0.035em'],
      'heading-1': ['36px', '1.02', '600', '-0.03em'],
      'heading-2': ['28px', '1.08', '600', '-0.025em'],
      'heading-3': ['22px', '1.15', '600', '-0.02em'],
      title: ['18px', '1.3', '600', '-0.015em'],
      excerpt: ['19px', '1.35', '400', '-0.01em'],
      'body-md': ['17px', '1.6', '400', '0'],
      'body-sm': ['15px', '1.5', '400', '0'],
      button: ['16px', '1.5', '600', '-0.01em'],
      caption: ['13px', '1.45', '400', '0'],
      eyebrow: ['11px', '1.4', '600', '0.08em'],
    }
    for (const [role, [size, height, weight, tracking]] of Object.entries(expected)) {
      const selector = `.website-type-${role}`
      const declarations = rules.declarations.filter(
        (entry) =>
          entry.header === selector &&
          !entry.ancestors.some((ancestor) => ancestor.startsWith('@media')),
      )
      expect(declarations.find((entry) => entry.prop === 'font-size')?.value, selector).toBe(size)
      expect(declarations.find((entry) => entry.prop === 'line-height')?.value, selector).toBe(
        height,
      )
      expect(declarations.find((entry) => entry.prop === 'font-weight')?.value, selector).toBe(
        weight,
      )
      expect(declarations.find((entry) => entry.prop === 'letter-spacing')?.value, selector).toBe(tracking)
      expect(declarations.find((entry) => entry.prop === 'font-family')?.value, selector).toBe(
        'var(--website-font-sans)',
      )
      expect(declarations.find((entry) => entry.prop === 'font-feature-settings')?.value, selector).toBe("'lnum', 'locl'")
    }
    expect(css).toMatch(/\.website-type-code\s*\{[^}]*font-family:\s*var\(--website-font-mono\)/s)
    for (const oldRole of ['display', 'heading-large', 'heading-medium', 'heading-small', 'body-large', 'body', 'body-small']) {
      expect(css).not.toMatch(new RegExp(`\\.website-type-${oldRole}\\s*\\{`))
    }
    expect(rules.declarations.filter((entry) => entry.prop.startsWith('margin'))).toEqual([])
    for (const [media, role, size] of [
      ['48rem', 'display-1', '80px'], ['48rem', 'display-2', '64px'], ['48rem', 'heading-1', '48px'],
      ['48rem', 'heading-2', '36px'], ['48rem', 'heading-3', '26px'], ['48rem', 'title', '20px'],
      ['48rem', 'excerpt', '22px'], ['48rem', 'eyebrow', '12px'],
      ['73.125rem', 'display-1', '112px'], ['73.125rem', 'display-2', '80px'], ['73.125rem', 'heading-1', '64px'],
      ['73.125rem', 'heading-2', '40px'], ['73.125rem', 'heading-3', '28px'], ['73.125rem', 'excerpt', '24px'],
    ] as const) {
      const declarations = rules.declarations.filter(
        (entry) =>
          entry.header === `.website-type-${role}` &&
          entry.ancestors.some((ancestor) => ancestor.startsWith('@media') && ancestor.includes(media)),
      )
      expect(declarations.find((entry) => entry.prop === 'font-size')?.value, `${role} @ ${media}`).toBe(size)
    }
    for (const role of ['display-1', 'display-2', 'heading-1', 'heading-2', 'heading-3', 'title']) {
      expect(css).toMatch(new RegExp(`\\.website-type-${role}\\s*\\{[^}]*text-wrap:\\s*balance`, 's'))
    }
    for (const role of ['body-md', 'body-sm', 'excerpt', 'caption']) {
      expect(css).not.toMatch(new RegExp(`\\.website-type-${role}\\s*\\{[^}]*text-wrap:`, 's'))
    }
    expect(css).toMatch(/\.website-type-eyebrow\s*\{[^}]*text-transform:\s*uppercase/s)
    expect(css).not.toMatch(/\.website-type-excerpt\s*\{[^}]*font-style:\s*italic/s)
  })

  it('keeps every content element rule within the owned RichText scope', () => {
    const rules = auditCss(read('src/styles/content.css'))
    for (const block of rules.blocks) {
      if (block.header.startsWith('@') || block.header === ':scope') continue
      const scoped =
        block.header.includes('.payload-richtext') ||
        block.ancestors.some((ancestor) => /^@scope\s*\([\s\S]*?\.payload-richtext/.test(ancestor))
      expect(scoped, `Unscoped selector at line ${block.line}: ${block.header}`).toBe(true)
    }
  })

  it('limits shell hover-only feedback to fine hover pointers while preserving selected state', () => {
    for (const file of ['src/Footer/index.module.css', 'src/Header/Nav/blocks.module.css']) {
      const rules = auditCss(read(file))
      for (const block of rules.blocks.filter((entry) => entry.header.includes(':hover'))) {
        expect(
          block.ancestors.some(
            (ancestor) =>
              ancestor.includes('(hover: hover)') && ancestor.includes('(pointer: fine)'),
          ),
          `${file}:${block.line} ${block.header}`,
        ).toBe(true)
      }
    }
    const headerCss = read('src/Header/Nav/blocks.module.css')
    expect(headerCss).toMatch(/\.categoryTabActive\s*\{[^}]*background:/s)
  })

  it('defines the approved primitives and semantic schemes', () => {
    const css = read('src/styles/tokens.css')
    for (const declaration of [
      '--website-color-brand-black: #0a0a0a;',
      '--website-color-neutral-900: #262629;',
      '--website-color-neutral-600: #76767f;',
      '--website-color-foreground: var(--website-color-neutral-900);',
      '--website-color-muted-foreground: var(--website-color-neutral-600);',
      '--website-radius-control: 8px;',
      '--website-radius-content: 12px;',
      '--website-control-default: 48px;',
      '--website-duration-standard: 240ms;',
      '--website-z-header: 50;',
      '--website-color-disabled-surface: var(--website-color-muted-surface);',
      '--website-color-disabled-surface: rgb(255 255 255 / 8%);',
      '--website-color-disabled-foreground: rgb(255 255 255 / 48%);',
      '--website-color-disabled-border: rgb(255 255 255 / 18%);',
    ])
      expect(css, declaration).toContain(declaration)

    const defaultTheme = css.match(/\[data-website-theme='default'\] \{([^}]+)\}/)?.[1]
    const inverseTheme = css.match(/\[data-website-theme='inverse'\] \{([^}]+)\}/)?.[1]

    expect(defaultTheme).toBeTruthy()
    expect(inverseTheme).toBeTruthy()
    expect(inverseTheme).toContain('--website-color-foreground: var(--website-color-brand-white);')
    expect(inverseTheme).toContain('--website-color-muted-surface: rgb(255 255 255 / 6%);')
  })

  it('keeps RichText code blocks on a readable dark inverse surface in either content theme', () => {
    const tokens = read('src/styles/tokens.css')
    const content = read('src/styles/content.css')
    expect(tokens).toContain('--website-color-code-surface: var(--website-color-brand-black);')
    expect(tokens).toContain('--website-color-code-foreground: var(--website-color-brand-white);')
    expect(tokens).toContain('--website-color-code-border: rgb(255 255 255 / 18%);')
    expect(content).toContain('--website-richtext-pre-bg: var(--website-color-code-surface);')
    expect(content).toContain('--website-richtext-pre-code: var(--website-color-code-foreground);')
    expect(content).toContain('--website-richtext-pre-border: var(--website-color-code-border);')
    expect(content).toMatch(
      /&:where\(pre\)\s*\{[^}]*border:\s*1px solid var\(--website-richtext-pre-border\);/s,
    )
  })

  it('resets every interactive semantic in nested default and inverse schemes', () => {
    const rules = auditCss(read('src/styles/tokens.css'))
    const semanticProperties = [
      '--website-color-surface',
      '--website-color-foreground',
      '--website-color-muted-foreground',
      '--website-color-interactive-surface',
      '--website-color-border',
      '--website-color-input',
      '--website-color-action',
      '--website-color-action-foreground',
      '--website-color-focus',
      '--website-color-focus-gap',
      '--website-color-disabled-surface',
      '--website-color-disabled-foreground',
      '--website-color-disabled-border',
    ]

    for (const selector of ["[data-website-theme='default']", "[data-website-theme='inverse']"]) {
      const declarations = rules.declarations.filter((entry) => entry.header === selector)
      for (const property of semanticProperties)
        expect(
          declarations.some((entry) => entry.prop === property),
          `${selector} resets ${property}`,
        ).toBe(true)
    }
  })

  it('defines global focus, selection, reduced-motion, and forced-colors foundations', () => {
    const css = read('src/styles/base.css')
    const rules = auditCss(css)
    const focusSelector = ':where(a, button, input, select, textarea, [tabindex]):focus-visible'
    const focus = rules.declarations.filter((entry) => entry.header === focusSelector)
    expect(focus.find((entry) => entry.prop === 'outline')?.value).toBe(
      '2px solid var(--website-color-focus)',
    )
    expect(focus.find((entry) => entry.prop === 'outline-offset')?.value).toBe('2px')

    const selection = rules.declarations.filter((entry) => entry.header === '::selection')
    expect(selection.find((entry) => entry.prop === 'background')?.value).toBe(
      'var(--website-color-action)',
    )
    expect(selection.find((entry) => entry.prop === 'color')?.value).toBe(
      'var(--website-color-action-foreground)',
    )

    expect(
      rules.blocks.some((block) => block.header === '@media (prefers-reduced-motion: reduce)'),
    ).toBe(true)
    const forcedColorFocus = rules.declarations.filter(
      (entry) =>
        entry.header === focusSelector &&
        entry.ancestors.includes('@media (forced-colors: active)'),
    )
    expect(forcedColorFocus.find((entry) => entry.prop === 'outline-color')?.value).toBe(
      'Highlight',
    )
    const forcedColorControls = rules.declarations.filter(
      (entry) =>
        entry.header === ":where(button, input, select, textarea, [role='button'])" &&
        entry.ancestors.includes('@media (forced-colors: active)'),
    )
    expect(forcedColorControls.find((entry) => entry.prop === 'border-color')?.value).toBe(
      'ButtonText',
    )
    expect(forcedColorControls.find((entry) => entry.prop === 'box-shadow')?.value).toBe('none')
  })

  it('keeps select visibility feedback while removing reduced-motion transforms', () => {
    const rules = auditCss(read('src/components/ui/select.module.css'))
    const reducedMotion = '@media (prefers-reduced-motion: reduce)'
    const popper = rules.declarations.filter(
      (entry) => entry.header === '.popper[data-side]' && entry.ancestors.includes(reducedMotion),
    )
    expect(popper.find((entry) => entry.prop === 'translate')?.value).toBe('none')

    for (const [selector, animationName] of [
      [".content[data-state='open']", 'fadeIn'],
      [".content[data-state='closed']", 'fadeOut'],
    ]) {
      const declarations = rules.declarations.filter(
        (entry) => entry.header === selector && entry.ancestors.includes(reducedMotion),
      )
      expect(declarations.find((entry) => entry.prop === 'animation-name')?.value).toBe(
        animationName,
      )
    }

    for (const keyframe of ['from', 'to'])
      expect(
        rules.declarations.some(
          (entry) =>
            entry.header === keyframe &&
            entry.ancestors.some((ancestor) => /^@keyframes fade(?:In|Out)$/.test(ancestor)) &&
            entry.prop === 'opacity',
        ),
      ).toBe(true)
  })

  it('maps inline form errors to readable default and inverse semantic colors', () => {
    const rules = auditCss(read('src/styles/tokens.css'))
    const inlineError = (selector: string) =>
      rules.declarations.find(
        (entry) =>
          entry.header === selector && entry.prop === '--website-status-error-inline-foreground',
      )?.value

    expect(inlineError(':root')).toBe('var(--website-status-error-foreground)')
    expect(inlineError("[data-website-theme='default']")).toBe(
      'var(--website-status-error-foreground)',
    )
    expect(inlineError("[data-website-theme='inverse']")).toBe(
      'var(--website-status-error-foreground)',
    )

    const declaration = (selector: string, property: string) =>
      rules.declarations.find((entry) => entry.header === selector && entry.prop === property)
        ?.value
    const resolveColor = (value: string, selector: string): string => {
      const token = value.match(/^var\((--[^)]+)\)$/)?.[1]
      return token
        ? resolveColor(declaration(selector, token) ?? declaration(':root', token)!, selector)
        : value
    }
    const luminance = (hex: string) => {
      const channels = hex.match(/[\da-f]{2}/gi)!.map((channel) => parseInt(channel, 16) / 255)
      const linear = channels.map((channel) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
      )
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const inverse = "[data-website-theme='inverse']"
    const foreground = luminance(resolveColor(inlineError(inverse)!, inverse))
    const background = luminance(resolveColor(declaration(inverse, '--website-color-background')!, inverse))
    const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    expect(contrast).toBeGreaterThanOrEqual(4.5)

    const errorRules = auditCss(read('src/collections/Pages/blocks/Form/Error/index.module.css'))
    expect(
      errorRules.declarations.find((entry) => entry.header === '.error' && entry.prop === 'color')
        ?.value,
    ).toBe('var(--website-status-error-inline-foreground)')
  })
})
