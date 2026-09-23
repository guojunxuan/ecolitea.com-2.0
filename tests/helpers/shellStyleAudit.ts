import ts from 'typescript'

import { auditCss, cssTerms } from './cssAudit'

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

const topLevelColors = (value: string) => cssTerms(value).map(parseColor)

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
  const tokens = auditCss(tokensSource)
  const values = new Map<string, string>()
  const defaults = new Map<string, string>()
  const deprecatedAliases = new Set<string>()
  for (const decl of tokens.declarations) {
    if (
      decl.header === ':root' &&
      decl.prop.startsWith('--website-color-') &&
      !defaults.has(decl.prop)
    ) {
      defaults.set(decl.prop, decl.value)
    }
    if (decl.prop.startsWith('--website-')) values.set(decl.prop, decl.value)
    else if (/^var\(--website-[\w-]+\)$/.test(decl.value.trim())) deprecatedAliases.add(decl.prop)
  }
  const inverse = new Map<string, Color>()
  for (const decl of tokens.declarations) {
    if (!decl.header.includes("[data-website-theme='inverse']")) continue
    const color = parseColor(decl.value)
    if (color) inverse.set(decl.prop, color)
  }
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
    return cssTerms(value).some(
      (part) =>
        part.replace(/\s+/g, '').toLowerCase() === tokenValue.replace(/\s+/g, '').toLowerCase() ||
        sameColor(parseColor(part), parseColor(tokenValue)),
    )
  }

  for (const decl of auditCss(source).declarations) {
    const prop = decl.prop.toLowerCase()
    const value = decl.value
    const location = `${file}:${decl.line}: ${prop}`
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
  }

  return violations
}

// Explicit global contracts keep this gate independent of any utility compiler.
// Unknown literal classes fail closed, including arbitrary utility families.
const globalClasses = new Set([
  'site-container',
  'wide-container',
  'reading-container',
  'website-section',
  'website-section--compact',
  'website-section--spacious',
  'website-type-code',
  'visually-hidden',
  'full-bleed',
  'payload-richtext',
  'payload-richtext--content',
  'payload-richtext--plain',
  'payload-richtext--inverse',
  'payload-richtext__embedded',
  // Owned Payload Admin hook, styled only in its component stylesheet.
  'site-settings-social-links',
])

export const scanShellClasses = (
  file: string,
  source: string,
  allowed = globalClasses,
): string[] => {
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
    if (ts.isConditionalExpression(node)) {
      scanExpression(node.whenTrue, seenVariables)
      scanExpression(node.whenFalse, seenVariables)
      return
    }
    if (ts.isBinaryExpression(node)) {
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        scanExpression(node.right, seenVariables)
      } else if (
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.PlusToken,
        ].includes(node.operatorToken.kind)
      ) {
        scanExpression(node.left, seenVariables)
        scanExpression(node.right, seenVariables)
      }
      return
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      // Imported module exports are opaque, but local class lookup maps are owned.
      if (ts.isIdentifier(node.expression) && !seenVariables.has(node.expression.text)) {
        const initializer = variables.get(node.expression.text)
        if (initializer && ts.isObjectLiteralExpression(initializer)) {
          const nextSeen = new Set(seenVariables).add(node.expression.text)
          for (const property of initializer.properties) {
            if (ts.isPropertyAssignment(property)) scanExpression(property.initializer, nextSeen)
          }
        }
      }
      return
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(parsed)
      if (name === 'cn' || name === 'clsx') {
        for (const argument of node.arguments) scanExpression(argument, seenVariables)
      } else if (name === 'cva') {
        if (node.arguments[0]) scanExpression(node.arguments[0], seenVariables)
        const options = node.arguments[1]
        if (options && ts.isObjectLiteralExpression(options)) {
          const variants = options.properties.find(
            (prop) => prop.name?.getText(parsed) === 'variants',
          )
          if (
            variants &&
            ts.isPropertyAssignment(variants) &&
            ts.isObjectLiteralExpression(variants.initializer)
          ) {
            for (const variant of variants.initializer.properties) {
              if (
                ts.isPropertyAssignment(variant) &&
                ts.isObjectLiteralExpression(variant.initializer)
              ) {
                for (const value of variant.initializer.properties) {
                  if (ts.isPropertyAssignment(value))
                    scanExpression(value.initializer, seenVariables)
                }
              }
            }
          }
        }
      } else {
        // Variant options and other function inputs are not class strings.
        scanExpression(node.expression, seenVariables)
      }
      return
    }
    if (ts.isObjectLiteralExpression(node)) {
      // clsx/cn object keys are classes; conditions are not.
      for (const property of node.properties) {
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isStringLiteralLike(property.name) || ts.isIdentifier(property.name))
        ) {
          scanLiteral(property.name, property.name.text)
        }
      }
      return
    }
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
      /className$/i.test(node.name.text) &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) scanLiteral(node.initializer, node.initializer.text)
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        scanExpression(node.initializer.expression)
      }
    }
    if (ts.isPropertyAssignment(node) && /className$/i.test(node.name.getText(parsed))) {
      scanExpression(node.initializer)
    }
    ts.forEachChild(node, walk)
  }
  walk(parsed)
  return candidates
    .filter(({ token }) => !allowed.has(token))
    .map(({ line, token }) => `${file}:${line}: ${token}`)
}
