import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { auditCss } from '../helpers/cssAudit'

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

describe('global visual foundation', () => {
  it('defines all nine margin-free type roles and the desktop heading steps', () => {
    const css = read('src/styles/typography.css')
    const rules = auditCss(css)
    const expected = {
      display: ['48px', '52px', '600'],
      'heading-large': ['28px', '32px', '600'],
      'heading-medium': ['24px', '30px', '600'],
      'heading-small': ['20px', '28px', '600'],
      'body-large': ['18px', '28px', '400'],
      body: ['16px', '26px', '400'],
      'body-small': ['14px', '22px', '400'],
      caption: ['12px', '18px', '400'],
      code: ['14px', '22px', '400'],
    }
    for (const [role, [size, height, weight]] of Object.entries(expected)) {
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
      expect(declarations.find((entry) => entry.prop === 'font-family')?.value, selector).toBe(
        role === 'code' ? 'var(--website-font-mono)' : 'var(--website-font-sans)',
      )
    }
    expect(rules.declarations.filter((entry) => entry.prop.startsWith('margin'))).toEqual([])
    for (const [role, size, height] of [
      ['display', '56px', '60px'],
      ['heading-large', '40px', '44px'],
      ['heading-medium', '28px', '34px'],
    ]) {
      const declarations = rules.declarations.filter(
        (entry) =>
          entry.header === `.website-type-${role}` &&
          entry.ancestors.includes('@media (width >= 48rem)'),
      )
      expect(declarations.find((entry) => entry.prop === 'font-size')?.value).toBe(size)
      expect(declarations.find((entry) => entry.prop === 'line-height')?.value).toBe(height)
    }
  })

  it('keeps every content element rule within the owned RichText scope', () => {
    const rules = auditCss(read('src/styles/content.css'))
    for (const block of rules.blocks) {
      if (block.header.startsWith('@') || block.header === ':scope') continue
      const scoped =
        block.header.includes('.payload-richtext') ||
        block.ancestors.some((ancestor) => /^@scope\s*\([^)]*\.payload-richtext/.test(ancestor))
      expect(scoped, `Unscoped selector at line ${block.line}: ${block.header}`).toBe(true)
    }
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
    expect(inlineError("[data-website-theme='inverse']")).toBe('var(--website-status-error-border)')

    const errorRules = auditCss(read('src/blocks/Form/Error/index.module.css'))
    expect(
      errorRules.declarations.find((entry) => entry.header === '.error' && entry.prop === 'color')
        ?.value,
    ).toBe('var(--website-status-error-inline-foreground)')
  })
})
