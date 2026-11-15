import { asRecord, extractParagraphs, lexicalBlockFields } from './lexical'
import { parseRulePath, type RulePathSegment, type TranslationRule } from './rules'

export type ExtractedField = { path: string; kind: 'text' | 'richtext-paragraph'; source: string }
type FieldVisitor = (value: unknown, path: string, replace: (value: unknown) => void) => void

/**
 * Runtime paths use array[id=encoded-row-id] and richText[block-id=encoded-fields-id].
 * Stored paths are never interpreted as setters: merge regenerates the allowed paths
 * from the current document, so removed rows and undeclared fields cannot be written.
 */
export function visitRuleFields(doc: unknown, rule: TranslationRule, visit: FieldVisitor): void {
  const walk = (value: unknown, segments: RulePathSegment[], path: string) => {
    const record = asRecord(value)
    const [segment, ...rest] = segments
    if (!record || !segment || !Object.hasOwn(record, segment.field)) return
    const child = record[segment.field]
    const childPath = path ? `${path}.${segment.field}` : segment.field
    if (!segment.row) {
      if (rest.length) walk(child, rest, childPath)
      else
        visit(child, childPath, (replacement) => {
          record[segment.field] = replacement
        })
      return
    }
    if (Array.isArray(child)) {
      for (const value of child) {
        const row = asRecord(value)
        if (!row || (segment.blockType && row.blockType !== segment.blockType)) continue
        if (typeof row.id !== 'string' && typeof row.id !== 'number') continue
        if (rest.length) walk(row, rest, `${childPath}[id=${encodeURIComponent(String(row.id))}]`)
      }
    } else if (segment.blockType) {
      for (const fields of lexicalBlockFields(child, segment.blockType)) {
        if (typeof fields.id !== 'string' && typeof fields.id !== 'number') continue
        if (rest.length)
          walk(fields, rest, `${childPath}[block-id=${encodeURIComponent(String(fields.id))}]`)
      }
    }
  }
  for (const [path, action] of Object.entries(rule)) {
    if (action === 'translate') walk(doc, parseRulePath(path), '')
  }
}

/** Repeated sources retain all destination paths; the task deduplicates provider requests. */
export function extract(doc: unknown, rule: TranslationRule): ExtractedField[] {
  const result: ExtractedField[] = []
  visitRuleFields(doc, rule, (value, path) => {
    if (typeof value === 'string') {
      if (value.trim()) result.push({ path, kind: 'text', source: value })
    } else {
      for (const paragraph of extractParagraphs(value)) {
        result.push({
          path: `${path}.${paragraph.path}`,
          kind: 'richtext-paragraph',
          source: paragraph.source,
        })
      }
    }
  })
  return result
}
