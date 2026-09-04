import { describe, expect, it } from 'vitest'

import {
  trimText,
  validateFooterColumnLabels,
  validateFooterNavigationLinks,
  validateFooterURL,
  validateNonBlankText,
} from '@/Footer/validation'

describe('Footer validation', () => {
  it('requires non-blank text and trims persisted text values', () => {
    expect(validateNonBlankText('   ')).toBeTypeOf('string')
    expect(validateNonBlankText(' Products ')).toBe(true)
    expect(trimText({ value: ' Products ' } as never)).toBe('Products')
    expect(trimText({ value: null } as never)).toBeNull()
  })

  it('rejects duplicate trimmed column labels while preserving case sensitivity', () => {
    expect(validateFooterColumnLabels([{ label: 'Products' }, { label: ' Products ' }])).toBeTypeOf(
      'string',
    )
    expect(validateFooterColumnLabels([{ label: 'Products' }, { label: 'products' }])).toBe(true)
  })

  it.each([
    'https://example.com/path',
    'http://example.com',
    '/about',
    '#newsletter',
    'mailto:hello@example.com',
    'tel:+15551234567',
  ])('accepts the supported custom URL form %s', (url) => {
    expect(validateFooterURL(url)).toBe(true)
  })

  it.each(['javascript:alert(1)', '//example.com', 'about', 'ftp://example.com', '   '])(
    'rejects unsupported custom URL form %s',
    (url) => {
      expect(validateFooterURL(url)).toBeTypeOf('string')
    },
  )

  it('rejects the same internal destination within one column', () => {
    expect(
      validateFooterNavigationLinks([
        { link: { type: 'reference', reference: { relationTo: 'pages', value: 'page-1' } } },
        {
          link: {
            type: 'reference',
            reference: { relationTo: 'pages', value: { id: 'page-1', title: 'About' } },
          },
        },
      ]),
    ).toBeTypeOf('string')
  })

  it('permits the same document id from different collections', () => {
    expect(
      validateFooterNavigationLinks([
        { link: { type: 'reference', reference: { relationTo: 'pages', value: 'shared-id' } } },
        { link: { type: 'reference', reference: { relationTo: 'posts', value: 'shared-id' } } },
      ]),
    ).toBe(true)
  })

  it('rejects duplicate trimmed custom URLs within one column', () => {
    expect(
      validateFooterNavigationLinks([
        { link: { type: 'custom', url: '/about' } },
        { link: { type: 'custom', url: ' /about ' } },
      ]),
    ).toBeTypeOf('string')
  })
})
