type Node = Record<string, unknown>
type Paragraph = { node: Node; path: string }
type Inline = { node: Node; leaf: boolean }

export const asRecord = (value: unknown): Node | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Node) : undefined

const childrenOf = (node: Node): unknown[] => (Array.isArray(node.children) ? node.children : [])
const blocks = new Set(['paragraph', 'heading', 'listitem', 'quote'])
const ignored = new Set(['code', 'upload', 'relationship', 'block'])

const escapeText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Decode the entities used by Google's REST responses without a DOM dependency. */
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    const normalized = name.toLowerCase()
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: '\u00a0',
    }
    if (!normalized.startsWith('#')) return named[normalized] ?? entity
    const point = normalized.startsWith('#x')
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10)
    return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point)
      : entity
  })

function paragraphs(value: unknown): Paragraph[] {
  const root = asRecord(asRecord(value)?.root)
  if (!root) return []
  const result: Paragraph[] = []
  const visit = (value: unknown, path: string) => {
    const node = asRecord(value)
    if (!node || ignored.has(String(node.type))) return
    if (blocks.has(String(node.type))) result.push({ node, path })
    childrenOf(node).forEach((child, index) => visit(child, `${path}.children[${index}]`))
  }
  visit(root, 'root')
  return result
}

function serialize(node: Node): { source: string; inlines: Inline[] } {
  const inlines: Inline[] = []
  const visit = (value: unknown): string => {
    const child = asRecord(value)
    if (!child) return ''
    const index = inlines.length
    const leaf = child.type === 'text' && typeof child.text === 'string'
    inlines.push({ node: child, leaf })
    if (leaf) return `<x${index}>${escapeText(child.text as string)}</x${index}>`
    if (child.type === 'link' || child.type === 'autolink') {
      return `<x${index}>${childrenOf(child).map(visit).join('')}</x${index}>`
    }
    // Preserve every nontext inline as an opaque placeholder, including line breaks.
    // Nested lists are translated through their own listitem paragraphs, not here.
    return `<x${index}/>`
  }
  return { source: childrenOf(node).map(visit).join(''), inlines }
}

export function extractParagraphs(value: unknown): { path: string; source: string }[] {
  return paragraphs(value).flatMap(({ node, path }) => {
    const { source, inlines } = serialize(node)
    return inlines.some(
      ({ node, leaf }) => leaf && typeof node.text === 'string' && node.text.trim(),
    )
      ? [{ path, source }]
      : []
  })
}

function apply(node: Node, translated: string): boolean {
  const { source, inlines } = serialize(node)
  const tagPattern = /<\/?x\d+\/?>/g
  const expected = source.match(tagPattern) ?? []
  const actual = translated.match(tagPattern) ?? []
  let valid =
    expected.length === actual.length && expected.every((tag, index) => tag === actual[index])
  const values = new Map<number, string>()
  const stack: number[] = []
  for (const token of translated.split(/(<\/?x\d+\/?>)/g)) {
    const tag = /^<(\/?)[x](\d+)(\/?)>$/.exec(token)
    if (tag) {
      const index = Number(tag[2])
      if (tag[1]) stack.pop()
      else if (!tag[3]) stack.push(index)
    } else if (token) {
      const index = stack.at(-1)
      if (index !== undefined && inlines[index]?.leaf && !token.includes('<')) {
        values.set(index, (values.get(index) ?? '') + decodeEntities(token))
      } else if (token.trim()) valid = false
    }
  }
  if (valid) {
    inlines.forEach(({ node, leaf }, index) => {
      if (leaf) node.text = values.get(index) ?? ''
    })
    return false
  }
  const plain = decodeEntities(translated.replace(/<[^>]*>/g, ''))
  let first = true
  for (const { node, leaf } of inlines) {
    if (!leaf) continue
    node.text = first ? plain : ''
    first = false
  }
  return true
}

/** Paragraph positions belong to the source version; array and Block rows use stable IDs. */
export function mergeParagraphs<T>(
  value: T,
  fields: Readonly<Record<string, string>>,
): { value: T; degraded: number } {
  const copy = structuredClone(value)
  let degraded = 0
  for (const { node, path } of paragraphs(copy)) {
    if (Object.hasOwn(fields, path) && typeof fields[path] === 'string') {
      if (apply(node, fields[path])) degraded++
    }
  }
  return { value: copy, degraded }
}

/** Find embedded Blocks only in the Lexical tree, never in arbitrary node metadata. */
export function lexicalBlockFields(value: unknown, blockType: string): Node[] {
  const result: Node[] = []
  const visit = (value: unknown) => {
    const node = asRecord(value)
    if (!node) return
    if (node.type === 'block') {
      const fields = asRecord(node.fields)
      if (fields?.blockType === blockType) result.push(fields)
      return
    }
    if (ignored.has(String(node.type))) return
    childrenOf(node).forEach(visit)
  }
  visit(asRecord(value)?.root)
  return result
}
