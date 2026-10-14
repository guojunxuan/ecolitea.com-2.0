import { describe, expect, it } from 'vitest'
import { adaptArticleShare } from '@/utilities/blogs/articleShare'
import { generateArticleShareURL } from '@/Settings/fields/articleShareTemplate'
import { validateArticleSharePlatforms } from '@/Settings/fields/validation'
import { blogTab } from '@/Settings/fields/blog'
import { validateSvgSiteAsset } from '@/collections/SiteAssets'
import { validations } from 'payload'
import type { ArrayField, CollapsibleField, GroupField, UploadField } from 'payload'

const icon = { id: 'icon', alt: 'Share', url: '/icon.svg', updatedAt: '', createdAt: '' }
const settings = (platforms: unknown[], copyLink?: boolean) =>
  ({ blog: { article: { share: { platforms, copyLink } } } }) as never

describe('article share adapter', () => {
  it('encodes every placeholder and preserves template text and order', () => {
    const result = adaptArticleShare(
      settings([
        { name: 'Web', icon, shareURL: 'https://example.com/?url={url}&title={title}&again={url}' },
        { name: 'Email', icon, shareURL: 'mailto:?subject={title}&body={url}' },
      ]),
      'https://tea.test/a?x=1&y=2',
      'Tea & 茶',
    )
    expect(result.copyLink).toBe(true)
    expect(result.links.map(({ name, href }) => ({ name, href }))).toEqual([
      {
        name: 'Web',
        href: 'https://example.com/?url=https%3A%2F%2Ftea.test%2Fa%3Fx%3D1%26y%3D2&title=Tea%20%26%20%E8%8C%B6&again=https%3A%2F%2Ftea.test%2Fa%3Fx%3D1%26y%3D2',
      },
      {
        name: 'Email',
        href: 'mailto:?subject=Tea%20%26%20%E8%8C%B6&body=https%3A%2F%2Ftea.test%2Fa%3Fx%3D1%26y%3D2',
      },
    ])
    expect(result.links[0].icon).toMatchObject({ src: '/icon.svg', alt: 'Share' })
  })
  it('skips unsupported protocols, malformed URLs, and unresolved icons', () => {
    const rows = [
      'javascript:alert(1)',
      'data:text/plain,test',
      'ftp://example.com',
      '/relative',
      'https://',
    ].map((shareURL) => ({ name: 'Unsafe', icon, shareURL }))
    rows.push({ name: 'Missing', icon: 'id' as never, shareURL: 'https://example.com' })
    rows.push({ name: 'HTTP', icon, shareURL: 'http://example.com' })
    expect(adaptArticleShare(settings(rows, false), 'https://tea.test', 'Tea')).toMatchObject({
      copyLink: false,
      links: [{ name: 'HTTP', href: 'http://example.com' }],
    })
  })
  it('defaults missing settings to copying and supports fully empty settings', () => {
    expect(adaptArticleShare(null, 'https://tea.test', 'Tea')).toEqual({
      links: [],
      copyLink: true,
    })
    expect(adaptArticleShare(settings([], false), 'https://tea.test', 'Tea')).toEqual({
      links: [],
      copyLink: false,
    })
  })
})
describe('article share configuration', () => {
  it.each([
    [' LinkedIn! ', 'https://www.linkedin.com/share?url={url}&title={title}'],
    ['X / Twitter', 'https://www.xtwitter.com/share?url={url}&title={title}'],
    [' E-MAIL ', 'mailto:?subject={title}&body={url}'],
    ['茶', ''],
  ])('generates a starter template for %s', (name, expected) =>
    expect(generateArticleShareURL(name)).toBe(expected),
  )
  it('rejects duplicate names with both row numbers and leaves distinct or empty arrays valid', () => {
    expect(
      validateArticleSharePlatforms(
        [{ name: 'Email' }, { name: 'Web' }, { name: ' email ' }] as never,
        { req: { t: () => 'Native error' } } as never,
      ),
    ).toBe('Share platform names in rows 1 and 3 must be different.')
    expect(
      validateArticleSharePlatforms(
        [{ name: 'Email' }, { name: 'Web' }] as never,
        { req: { t: () => 'Native error' } } as never,
      ),
    ).toBe(true)
    expect(
      validateArticleSharePlatforms([] as never, { req: { t: () => 'Native error' } } as never),
    ).toBe(true)
  })
  it('rejects a non SVG article icon through its configured validator', async () => {
    const article = blogTab.fields[1] as GroupField
    const section = article.fields[0] as CollapsibleField
    const share = section.fields[0] as GroupField
    const platforms = share.fields[0] as ArrayField
    const upload = platforms.fields[1] as UploadField
    expect(await upload.validate!({ mimeType: 'image/png' } as never, { req: {} } as never)).toBe(
      'Icons must be SVG files.',
    )
  })
  it('uses required native fields, the shared SVG constraint, and empty defaults', () => {
    const article = blogTab.fields[1] as GroupField
    expect(article).toMatchObject({ name: 'article', type: 'group' })
    const section = article.fields[0] as CollapsibleField
    expect(section).toMatchObject({ label: 'Share', type: 'collapsible' })
    const share = section.fields[0] as GroupField
    expect('name' in share && share.name).toBe('share')
    const platforms = share.fields[0] as ArrayField
    expect(platforms).toMatchObject({
      name: 'platforms',
      type: 'array',
      defaultValue: [],
      validate: validateArticleSharePlatforms,
    })
    expect(platforms.fields).toEqual([
      expect.objectContaining({ name: 'name', type: 'text', required: true }),
      expect.objectContaining({
        name: 'icon',
        type: 'upload',
        required: true,
        relationTo: 'site-assets',
        validate: validateSvgSiteAsset,
        filterOptions: { mimeType: { equals: 'image/svg+xml' } },
      }),
      expect.objectContaining({ name: 'shareURL', type: 'text', required: true }),
    ])
    expect(platforms.fields[2]).not.toHaveProperty('validate')
    const nativeOptions = {
      required: true,
      req: { payload: { config: {} }, t: () => 'Required' },
    } as never
    expect(validations.text('', nativeOptions)).toBe('Required')
    expect(validations.text('javascript:alert(1)', nativeOptions)).toBe(true)
    expect(share.fields[1]).toMatchObject({
      name: 'copyLink',
      type: 'checkbox',
      defaultValue: true,
    })
  })
})
