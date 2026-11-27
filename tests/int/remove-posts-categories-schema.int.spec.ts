import { expect, it } from 'vitest'
import type { Field } from 'payload'
import configPromise from '@payload-config'
import { Archive } from '@/collections/Pages/blocks/Archive/config'

const retired = ['posts', 'categories']

function assertRelationshipTargets(fields: Field[], path: string) {
  for (const field of fields) {
    const fieldPath = 'name' in field ? `${path}.${field.name}` : path
    if ('relationTo' in field) {
      for (const target of [field.relationTo].flat()) {
        expect(retired, fieldPath).not.toContain(target)
      }
    }
    if ('fields' in field) assertRelationshipTargets(field.fields, fieldPath)
    if (field.type === 'tabs') {
      for (const tab of field.tabs) assertRelationshipTargets(tab.fields, `${fieldPath}.${tab.label}`)
    }
    if (field.type === 'blocks') {
      for (const block of field.blocks) {
        if (typeof block !== 'string') assertRelationshipTargets(block.fields, `${fieldPath}.${block.slug}`)
      }
    }
  }
}

it('excludes retired collections and their relationship targets from the active schemas', async () => {
  const { collections, globals, blocks } = await configPromise
  expect(collections.map(({ slug }) => slug)).not.toContain('posts')
  expect(collections.map(({ slug }) => slug)).not.toContain('categories')
  for (const { slug, fields } of [...collections, ...globals, ...(blocks ?? [])]) {
    assertRelationshipTargets(fields, slug)
  }
})

it('exposes Blogs and Blog Categories in the Page Archive editor', () => {
  expect(Archive.fields).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'relationTo', defaultValue: 'blogs', options: [{ label: 'Blogs', value: 'blogs' }],
    }),
    expect.objectContaining({ name: 'categories', relationTo: 'blog-categories', hasMany: true }),
    expect.objectContaining({ name: 'selectedDocs', relationTo: ['blogs'], hasMany: true }),
  ]))
})
