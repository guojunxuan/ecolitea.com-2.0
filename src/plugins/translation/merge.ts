import { visitRuleFields } from './extract'
import { extractParagraphs, mergeParagraphs } from './lexical'
import type { TranslationRule } from './rules'

export function mergeWithDiagnostics<T>(
  doc: T,
  fields: Readonly<Record<string, string>>,
  rule: TranslationRule,
): { doc: T; degraded: number } {
  const copy = structuredClone(doc)
  let degraded = 0
  visitRuleFields(copy, rule, (value, path, replace) => {
    if (typeof value === 'string') {
      if (Object.hasOwn(fields, path) && typeof fields[path] === 'string') replace(fields[path])
    } else {
      const paragraphs: Record<string, string> = {}
      for (const paragraph of extractParagraphs(value)) {
        const fullPath = `${path}.${paragraph.path}`
        if (Object.hasOwn(fields, fullPath) && typeof fields[fullPath] === 'string') {
          paragraphs[paragraph.path] = fields[fullPath]
        }
      }
      if (Object.keys(paragraphs).length) {
        const result = mergeParagraphs(value, paragraphs)
        replace(result.value)
        degraded += result.degraded
      }
    }
  })
  return { doc: copy, degraded }
}

export function merge<T>(
  doc: T,
  fields: Readonly<Record<string, string>>,
  rule: TranslationRule,
): T {
  return mergeWithDiagnostics(doc, fields, rule).doc
}
