import type { Blog } from '@/payload-types'

export type TOCItem = { id: string; text: string; level: 2 | 3 }

type TextNode = { type?: string; text?: string; children?: unknown }

const textFromNode = (value: unknown): string => {
  if (!value || typeof value !== 'object') return ''
  const node = value as TextNode
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
  if (!Array.isArray(node.children)) return ''
  return node.children.map(textFromNode).join('')
}

export const getHeadingText = (heading: { children: unknown }): string =>
  textFromNode(heading).replace(/\s+/gu, ' ').trim()

export const slugifyHeadingText = (text: string): string =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

export const extractTOCByBlock = (blocks: Blog['content']): TOCItem[][] => {
  const counts = new Map<string, number>()
  const used = new Set<string>()

  return blocks.map((block) => {
    if (block.blockType !== 'prose') return []
    const items: TOCItem[] = []

    for (const node of block.content.root.children) {
      if (node.type !== 'heading' || (node.tag !== 'h2' && node.tag !== 'h3')) continue
      const text = getHeadingText(node)
      const base = slugifyHeadingText(text)
      if (!base) continue

      let count = (counts.get(base) ?? 0) + 1
      let id = count === 1 ? base : `${base}-${count}`
      while (used.has(id)) {
        count += 1
        id = `${base}-${count}`
      }
      counts.set(base, count)
      used.add(id)
      items.push({ id, text, level: node.tag === 'h2' ? 2 : 3 })
    }

    return items
  })
}

export const extractTOC = (blocks: Blog['content']): TOCItem[] => extractTOCByBlock(blocks).flat()
