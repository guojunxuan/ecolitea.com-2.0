import { describe, expect, it } from 'vitest'
import type { CollapsibleField } from 'payload'
import { blogTab } from '@/Settings/fields/blog'

describe('Blog settings fields', () => {
  it('puts clearly named sections directly under the Blog tab', () => {
    expect(blogTab.fields.map((field) => ('label' in field ? field.label : undefined))).toEqual([
      'Listing Hero',
      'Listing SEO',
      'Article Sharing',
    ])
    expect(blogTab.fields.every((field) => 'type' in field && field.type === 'collapsible')).toBe(
      true,
    )
    expect((blogTab.fields[0] as CollapsibleField).admin?.style?.marginBottom).toBe(
      'var(--spacer-2-5)',
    )
    expect((blogTab.fields[1] as CollapsibleField).admin?.style?.marginBottom).toBe(
      'var(--spacer-2-5)',
    )
  })
})
