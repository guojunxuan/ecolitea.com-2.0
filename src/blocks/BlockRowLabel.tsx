'use client'

import { useRowLabel, useWatchForm } from '@payloadcms/ui'

type BlockData = {
  heading?: string | null
  title?: string | null
  label?: string | null
  content?: unknown
  caption?: unknown
}

function textFromNode(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('root' in value) return textFromNode(value.root)
  if ('children' in value && Array.isArray(value.children))
    return value.children.map(textFromNode).join(' ')
  return ''
}

function Summary({ data, label = 'Block' }: { data?: BlockData; label?: string }) {
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

function EmbeddedLabel({ path, label }: { path: string; label?: string }) {
  const { getSiblingData } = useWatchForm()
  return <Summary data={getSiblingData(path)} label={label} />
}

// Collection blocks supply row context; Lexical labels supply the UI field path.
export function BlockRowLabel({ path, label }: { path?: string; label?: string }) {
  const row = useRowLabel<BlockData>()
  if (row.path) return <Summary data={row.data} label={label} />
  if (path) return <EmbeddedLabel path={path} label={label} />
  return <Summary data={row.data} label={label} />
}
