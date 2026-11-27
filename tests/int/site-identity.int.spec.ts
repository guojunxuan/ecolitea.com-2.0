import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatTitle, normalizeSiteIdentity } from '@/utilities/siteIdentity'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

describe('Site identity', () => {
  it('normalizes empty or whitespace-only fields as absent', () => {
    expect(normalizeSiteIdentity(null)).toEqual({})
    expect(normalizeSiteIdentity({ siteName: '  Tea Studio ', siteDescription: '  ' })).toEqual({
      siteName: 'Tea Studio',
    })
    expect(normalizeSiteIdentity({ siteDescription: '  About us ' })).toEqual({
      siteDescription: 'About us',
    })
  })

  it.each([
    [' About ', ' Tea Studio ', 'About | Tea Studio'],
    ['About', null, 'About'],
    ['  ', 'Tea Studio', 'Tea Studio'],
    [undefined, undefined, ''],
  ])('formats %s with %s', (title, name, expected) => {
    expect(formatTitle(title, name)).toBe(expected)
  })

  it('uses only configured Open Graph identity and allows per-document fields', () => {
    expect(mergeOpenGraph({})).toEqual({ type: 'website' })
    expect(mergeOpenGraph(
      { siteName: 'Tea Studio', siteDescription: 'Site description' },
      { title: 'Article', description: 'Specific description' },
    )).toEqual({
      type: 'website', siteName: 'Tea Studio', title: 'Article', description: 'Specific description',
    })
  })

  it('guards source files from reintroducing legacy brand literals', () => {
    for (const name of readdirSync('src', { recursive: true, withFileTypes: true })) {
      if (!name.isFile()) continue
      const path = `${name.parentPath}/${name.name}`.replace(/^src\//, '')
      if (path === 'payload-types.ts' || path.startsWith('migrations/')) continue
      const source = readFileSync(`src/${path}`, 'utf8')
      expect(source, path).not.toMatch(/Ecolitea|Payload Website Template|@payloadcms['"]/)
    }
  })
})
