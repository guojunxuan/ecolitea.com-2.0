import { readFileSync } from 'node:fs'
import path from 'node:path'

import postcss, { type AtRule } from 'postcss'
import { compile } from 'tailwindcss'
import ts from 'typescript'

type Color = { red: number; green: number; blue: number; alpha: number }

const colorPattern = /#[\da-f]{3,8}\b|\brgba?\([^)]*\)|\bwhite\b/gi

const parseColor = (source: string): Color | null => {
  const value = source.trim().toLowerCase()
  if (value === 'white') return { red: 255, green: 255, blue: 255, alpha: 1 }
  if (/^oklch\(100%\s+0\s+0deg\)$/.test(value)) {
    return { red: 255, green: 255, blue: 255, alpha: 1 }
  }

  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const full = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
    if (full.length !== 6 && full.length !== 8) return null
    return {
      red: Number.parseInt(full.slice(0, 2), 16),
      green: Number.parseInt(full.slice(2, 4), 16),
      blue: Number.parseInt(full.slice(4, 6), 16),
      alpha: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
    }
  }

  const argumentsMatch = value.match(/^rgba?\((.*)\)$/)
  if (!argumentsMatch) return null
  const channels = argumentsMatch[1]!.split(/[\s,/]+/).filter(Boolean)
  if (channels.length < 3 || channels.length > 4) return null
  const number = (part: string, scale: number) =>
    part.endsWith('%') ? (Number.parseFloat(part) / 100) * scale : Number(part)
  const parsed = channels.map((channel, index) => number(channel, index === 3 ? 1 : 255))
  if (parsed.some((channel) => !Number.isFinite(channel))) return null
  return { red: parsed[0]!, green: parsed[1]!, blue: parsed[2]!, alpha: parsed[3] ?? 1 }
}

const sameColor = (left: Color | null, right: Color | null) =>
  left !== null &&
  right !== null &&
  left.red === right.red &&
  left.green === right.green &&
  left.blue === right.blue &&
  Math.abs(left.alpha - right.alpha) < 0.000001

const topLevelColors = (value: string) =>
  postcss.list.comma(value).flatMap((layer) => postcss.list.space(layer).map(parseColor))

const sameUnitLength = (left: string, right: string) => {
  const parse = (value: string) => value.trim().match(/^([\d.]+)(rem|px)$/i)
  const a = parse(left)
  const b = parse(right)
  return Boolean(a && b && a[2] === b[2] && Number(a[1]) === Number(b[1]))
}

const durationMs = (value: string) => {
  const match = value.match(/^([\d.]+)(ms|s)$/i)
  return match ? Number(match[1]) * (match[2]!.toLowerCase() === 's' ? 1000 : 1) : null
}

const normalizedShadow = (value: string) =>
  value
    .replace(colorPattern, (match) => {
      const color = parseColor(match)
      return color ? `rgba(${color.red},${color.green},${color.blue},${color.alpha})` : match
    })
    .replace(/\s+/g, '')
    .toLowerCase()

export const scanShellCss = (file: string, source: string, tokensSource: string): string[] => {
  const tokens = postcss.parse(tokensSource)
  const values = new Map<string, string>()
  const defaults = new Map<string, string>()
  const deprecatedAliases = new Set<string>()
  tokens.walkRules((rule) => {
    if (rule.selector !== ':root') return
    rule.walkDecls((decl) => {
      if (decl.prop.startsWith('--website-color-') && !defaults.has(decl.prop)) {
        defaults.set(decl.prop, decl.value)
      }
    })
  })
  tokens.walkDecls((decl) => {
    if (decl.prop.startsWith('--website-')) values.set(decl.prop, decl.value)
    else if (/^var\(--website-[\w-]+\)$/.test(decl.value.trim())) deprecatedAliases.add(decl.prop)
  })
  const inverse = new Map<string, Color>()
  tokens.walkRules((rule) => {
    if (!rule.selector.includes("[data-website-theme='inverse']")) return
    rule.walkDecls((decl) => {
      const color = parseColor(decl.value)
      if (color) inverse.set(decl.prop, color)
    })
  })
  const radii = ['control', 'content', 'pill']
    .map((name) => ({ name, value: values.get(`--website-radius-${name}`) }))
    .filter((radius): radius is { name: string; value: string } => radius.value !== undefined)
  const durations = ['fast', 'standard', 'slow']
    .map((name) => ({ name, value: durationMs(values.get(`--website-duration-${name}`) ?? '') }))
    .filter((duration): duration is { name: string; value: number } => duration.value !== null)
  const shadows = [...values.entries()]
    .filter(([name]) => name.startsWith('--website-shadow-'))
    .map(([name, value]) => ({ name, value: normalizedShadow(value) }))
  const violations: string[] = []
  const isFooter = file.startsWith('src/Footer/')
  const sameTokenColor = (value: string, token: string) => {
    const tokenValue = defaults.get(token)
    if (!tokenValue) return false
    return postcss.list
      .comma(value)
      .some((layer) =>
        postcss.list
          .space(layer)
          .some(
            (part) =>
              part.replace(/\s+/g, '').toLowerCase() ===
                tokenValue.replace(/\s+/g, '').toLowerCase() ||
              sameColor(parseColor(part), parseColor(tokenValue)),
          ),
      )
  }

  postcss.parse(source, { from: file }).walkDecls((decl) => {
    const prop = decl.prop.toLowerCase()
    const value = decl.value
    const location = `${file}:${decl.source?.start?.line ?? '?'}: ${prop}`
    for (const [, alias] of value.matchAll(/var\(--([\w-]+)\)/g)) {
      if (deprecatedAliases.has(`--${alias}`))
        violations.push(`${location}: deprecated token --${alias}`)
    }

    if (isFooter) {
      const colors = topLevelColors(value)
      const hasColor = (token: string) =>
        colors.some((color) => sameColor(color, inverse.get(token) ?? null))
      if (/^background(?:-color)?$/.test(prop) && hasColor('--website-color-background')) {
        violations.push(`${location}: raw inverse background`)
      }
      if (prop === 'color' && hasColor('--website-color-foreground')) {
        violations.push(`${location}: raw inverse foreground`)
      }
      if (prop === 'color' && hasColor('--website-color-muted-foreground')) {
        violations.push(`${location}: raw inverse muted foreground`)
      }
      if (/^border(?:-|$)/.test(prop) && hasColor('--website-color-border')) {
        violations.push(`${location}: raw inverse border`)
      }
    } else {
      if (
        /^background(?:-color)?$/.test(prop) &&
        sameTokenColor(value, '--website-color-background')
      ) {
        violations.push(`${location}: raw default background`)
      }
      if (prop === 'color' && sameTokenColor(value, '--website-color-foreground')) {
        violations.push(`${location}: raw default foreground`)
      }
      if (/^border(?:-|$)/.test(prop) && sameTokenColor(value, '--website-color-border')) {
        violations.push(`${location}: raw default border`)
      }
    }

    if ((prop.startsWith('border-') && prop.endsWith('radius')) || prop === 'border-radius') {
      for (const rawRadius of value.split(/[\s/]+/)) {
        for (const radius of radii) {
          if (sameUnitLength(rawRadius, radius.value)) {
            violations.push(`${location}: raw ${radius.name} radius`)
          }
        }
      }
    }

    if (prop.startsWith('transition')) {
      for (const [, rawDuration] of value.matchAll(/(?<![\w.])(\d*\.?\d+(?:ms|s))\b/gi)) {
        const milliseconds = durationMs(rawDuration!)
        for (const duration of durations) {
          // Header's 260ms surface timing is explicitly owned by Header.
          if (duration.name === 'standard' && !isFooter) continue
          if (milliseconds === duration.value) {
            violations.push(`${location}: raw ${duration.name} duration`)
          }
        }
      }
    }

    if (prop === 'box-shadow') {
      for (const shadow of shadows) {
        if (normalizedShadow(value) === shadow.value) {
          violations.push(`${location}: raw shared shadow ${shadow.name}`)
        }
      }
    }
  })

  return violations
}

// Compile against the installed public Tailwind API and this site's actual theme/plugins.
// A valid candidate adds CSS; project-owned class hooks such as `site-container` do not.
const compileWebsiteUtilities = async () => {
  const theme = readFileSync(path.join(process.cwd(), 'node_modules/tailwindcss/theme.css'), 'utf8')
  const globals = postcss.parse(
    readFileSync(path.join(process.cwd(), 'src/app/(frontend)/globals.css'), 'utf8'),
  )
  const extensions = globals.nodes
    .filter(
      (node): node is AtRule =>
        node.type === 'atrule' && ['theme', 'custom-variant', 'plugin'].includes(node.name),
    )
    .map((node) => `${node.toString()}${node.nodes ? '' : ';'}`)
    .join('\n')

  return compile(`${theme}\n${extensions}\n@tailwind utilities;`, {
    loadModule: async (id, base) => ({
      path: import.meta.resolve(id),
      base,
      module: (await import(id)).default,
    }),
  })
}

// These Tailwind marker classes generate no standalone CSS but activate variants/plugins.
const cssLessMarker = /^(?:(?:group|peer)(?:\/[\w-]+)?|not-prose)$/

export const scanShellClasses = async (file: string, source: string): Promise<string[]> => {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const variables = new Map<string, ts.Expression>()
  const collectVariables = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      variables.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, collectVariables)
  }
  collectVariables(parsed)
  const candidates: Array<{ line: number; token: string }> = []

  const scanLiteral = (node: ts.Node, value: string) => {
    const line = parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1
    for (const token of value.split(/\s+/).filter(Boolean)) candidates.push({ line, token })
  }
  const scanExpression = (node: ts.Node, seenVariables = new Set<string>()) => {
    if (ts.isStringLiteralLike(node)) {
      scanLiteral(node, node.text)
      return
    }
    if (ts.isTemplateExpression(node)) {
      scanLiteral(node.head, node.head.text)
      for (const span of node.templateSpans) {
        scanExpression(span.expression, seenVariables)
        scanLiteral(span.literal, span.literal.text)
      }
      return
    }
    if (ts.isElementAccessExpression(node)) return // CSS-module computed export key.
    if (ts.isIdentifier(node)) {
      const initializer = variables.get(node.text)
      if (initializer && !seenVariables.has(node.text)) {
        const nextSeen = new Set(seenVariables).add(node.text)
        scanExpression(initializer, nextSeen)
      }
      return
    }
    ts.forEachChild(node, (child) => scanExpression(child, seenVariables))
  }
  const walk = (node: ts.Node) => {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'className' &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) scanLiteral(node.initializer, node.initializer.text)
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        scanExpression(node.initializer.expression)
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  const compiler = await compileWebsiteUtilities()
  const checked = new Map<string, boolean>()
  const violations: string[] = []
  let compiled = compiler.build([])
  for (const { line, token } of candidates) {
    let valid = checked.get(token)
    if (valid === undefined) {
      const next = compiler.build([token])
      valid = cssLessMarker.test(token) || next !== compiled
      compiled = next
      checked.set(token, valid)
    }
    if (valid) violations.push(`${file}:${line}: ${token}`)
  }
  return violations
}
