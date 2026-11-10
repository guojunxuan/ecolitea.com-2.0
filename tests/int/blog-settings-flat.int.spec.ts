import { describe, expect, it } from 'vitest'
import type { GroupField } from 'payload'
import { blogTab } from '@/Settings/fields/blog'

describe('Blog settings fields', () => {
  it('groups overview and article controls without adding data paths', () => {
    expect(blogTab.fields.map((field) => ('label' in field ? field.label : undefined))).toEqual([
      'Overview',
      'Articles',
    ])
    const [overview, articles] = blogTab.fields as GroupField[]
    for (const group of [overview, articles]) {
      expect(group.type).toBe('group')
      expect(group).not.toHaveProperty('name')
      expect(group.fields.every((field) => field.type === 'collapsible')).toBe(true)
    }
    expect(overview.admin?.description).toBe(
      'Hero and search settings for the blog overview page (/blogs). Category pages share the Hero media and Header Theme, with their own title and description.',
    )
    expect(overview.fields).toMatchObject([
      {
        label: 'Hero',
        admin: { initCollapsed: false },
      },
      {
        label: 'SEO',
        admin: {
          initCollapsed: true,
        },
      },
    ])
    for (const field of [...overview.fields, ...articles.fields]) {
      if (field.type !== 'collapsible') throw new Error('Expected a collapsible settings section')
      expect(field.admin?.description).toBeUndefined()
    }
    expect(articles.admin?.description).toBe('Settings applied to every blog article.')
    expect(articles.fields).toMatchObject([
      {
        label: 'Sharing',
        admin: { initCollapsed: true },
        fields: [{ name: 'share' }],
      },
    ])
  })
})
