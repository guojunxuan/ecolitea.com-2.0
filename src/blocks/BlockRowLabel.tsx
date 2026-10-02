'use client'

import { useRowLabel, useWatchForm } from '@payloadcms/ui'

type BlockData = {
  blockType?: string
  heading?: string | null
  title?: string | null
  label?: string | null
  content?: unknown
  caption?: unknown
}

const labels: Record<string, string> = {
  prose: 'Prose',
  mediaBlock: 'Media',
  keyTakeaways: 'Key Takeaways',
  cta: 'Call to Action',
  banner: 'Banner',
}

function textFromNode(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('root' in value) return textFromNode(value.root)
  if ('children' in value && Array.isArray(value.children))
    return value.children.map(textFromNode).join(' ')
  return ''
}

function Summary({ data }: { data?: BlockData }) {
  const label = labels[data?.blockType || ''] || 'Block'
  const summary = (
    data?.heading ||
    data?.title ||
    data?.label ||
    textFromNode(data?.content || data?.caption)
  )
    .trim()
    .slice(0, 80)
  return <span>{summary ? `${label}: ${summary}` : label}</span>
}

function EmbeddedLabel({ path }: { path: string }) {
  const { getSiblingData } = useWatchForm()
  return <Summary data={getSiblingData(path)} />
}

// Collection blocks supply row context; Lexical labels supply the UI field path.
export function BlockRowLabel({ path }: { path?: string }) {
  const row = useRowLabel<BlockData>()
  if (row.path) return <Summary data={row.data} />
  if (path) return <EmbeddedLabel path={path} />
  return <Summary data={row.data} />
}
