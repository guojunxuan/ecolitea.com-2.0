export type CssBlock = { header: string; ancestors: string[]; line: number }
export type CssDeclaration = CssBlock & { prop: string; value: string }

// A lexical visitor for audit needs, not a CSS compiler. Ignore delimiters inside
// comments, quoted/escaped strings, functions, and attribute selectors.
export const cssSegments = (source: string, delimiters: RegExp) => {
  const segments: Array<{ text: string; delimiter: string; line: number }> = []
  let text = ''
  let quote = ''
  let depth = 0
  let line = 1
  let startLine = 1
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (char === '\n') line++
    if (char === '\\') {
      text += char + (source[++index] ?? '')
      continue
    }
    if (quote) {
      text += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      if (end < 0) throw new Error('Unclosed CSS comment')
      line += source.slice(index, end + 2).split('\n').length - 1
      text += ' '
      index = end + 1
      continue
    }
    if (char === '"' || char === "'") quote = char
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth--
    if (depth === 0 && !quote && delimiters.test(char)) {
      segments.push({ text: text.trim(), delimiter: char, line: startLine })
      text = ''
      startLine = line
    } else {
      if (!text.trim()) startLine = line
      text += char
    }
  }
  if (quote || depth !== 0) throw new Error('Unbalanced CSS value')
  if (text.trim()) segments.push({ text: text.trim(), delimiter: '', line: startLine })
  return segments
}

export const cssTerms = (value: string) =>
  cssSegments(value, /[\s,]/)
    .map(({ text }) => text)
    .filter(Boolean)

export const auditCss = (source: string) => {
  const blocks: CssBlock[] = []
  const declarations: CssDeclaration[] = []
  const ancestors: string[] = []
  for (const { text, delimiter, line } of cssSegments(source, /[{};]/)) {
    if (delimiter === '{') {
      blocks.push({ header: text, ancestors: [...ancestors], line })
      ancestors.push(text)
    } else {
      const match = text.match(/^([\w-]+)\s*:\s*([\s\S]*)$/)
      if (match && ancestors.length) {
        declarations.push({
          prop: match[1]!,
          value: match[2]!,
          header: ancestors.at(-1)!,
          ancestors: [...ancestors],
          line,
        })
      }
      if (delimiter === '}') {
        if (!ancestors.length) throw new Error('Unexpected CSS closing brace')
        ancestors.pop()
      }
    }
  }
  if (ancestors.length) throw new Error('Unclosed CSS block')
  return { blocks, declarations }
}
