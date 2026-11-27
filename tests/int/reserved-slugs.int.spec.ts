import { describe, expect, it } from 'vitest'
import type { SlugField } from 'payload'
import { Pages } from '@/collections/Pages'

const slugField = Pages.fields.find(
  (field) => 'name' in field && field.name === 'slug',
) as SlugField

describe('root Page slug validation', () => {
  it.each(['de', 'zh-tw', 'en', 'FR', 'xx'])(
    'rejects reserved language-shaped slug %s',
    async (slug) => {
      expect(slugField.validate).toBeTypeOf('function')
      expect(await slugField.validate!(slug, {} as never)).toMatch(/reserved.*language/i)
    },
  )

  it.each(['dev', 'd', 'about', 'home', 'zh-hant'])('keeps ordinary slug %s', async (slug) => {
    expect(slugField.validate).toBeTypeOf('function')
    expect(await slugField.validate!(slug, {} as never)).toBe(true)
  })
})
