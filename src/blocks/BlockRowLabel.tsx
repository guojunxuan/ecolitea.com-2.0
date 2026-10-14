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
  mediaBlock: 'Media',
  keyTakeaways: 'Key Points',
  cta: 'Action Card',
  banner: 'Notice',
}

function textFromNode(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('root' in value) return textFromNode(value.root)
  if ('children' in value && Array.isArray(value.children))
    return value.children.map(textFromNode).join(' ')
  return ''
}

function Summary({ data, blockType }: { data?: BlockData; blockType?: string }) {
  const label = labels[blockType || data?.blockType || ''] || 'Block'
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

function EmbeddedLabel({ path, blockType }: { path: string; blockType?: string }) {
  const { getSiblingData } = useWatchForm()
  return <Summary data={getSiblingData(path)} blockType={blockType} />
}

// Collection blocks supply row context; Lexical labels supply the UI field path.
export function BlockRowLabel({ path, blockType }: { path?: string; blockType?: string }) {
  const row = useRowLabel<BlockData>()
  if (row.path) return <Summary data={row.data} blockType={blockType} />
  if (path) return <EmbeddedLabel path={path} blockType={blockType} />
  return <Summary data={row.data} blockType={blockType} />
}
