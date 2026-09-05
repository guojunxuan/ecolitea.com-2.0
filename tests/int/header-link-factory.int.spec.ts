import { describe, expect, it } from 'vitest'

import { link } from '@/fields/link'
import { trimText, validateNavigationURL, validateNonBlankText } from '@/fields/linkValidation'

type LinkGroup = ReturnType<typeof link>

/**
 * A minimal structural view of a Payload field for the purposes of these
 * assertions. `fields` is present on row/array/group/block fields only, so it
 * is optional here.
 */
interface AnyField {
  name?: string
  fields?: AnyField[]
  type?: string
  relationTo?: string | string[]
  [key: string]: unknown
}

/**
 * Helper: return every field object reachable from a `link()` group — both
 * the top-level fields (used when `disableLabel` places the link types
 * directly at the top level) and the fields nested inside groups.
 *
 * `link()` is typed as returning the broad `Field` union, so the group's
 * `.fields` array is read here via a narrowed cast.
 */
function collectFields(linkGroup: LinkGroup): AnyField[] {
  const topLevel = linkGroup as unknown as AnyField
  return (topLevel.fields ?? []).flatMap((field) => [field, ...(field.fields ?? [])])
}

/**
 * Helper: pull the reference relationship field out of a `link()` group so
 * tests can assert on its `relationTo` and presence without reaching into
 * nested field arrays in every assertion.
 */
function getReferenceField(linkGroup: LinkGroup): AnyField {
  const reference = collectFields(linkGroup).find((field) => field.name === 'reference')

  if (!reference || reference.type !== 'relationship') {
    throw new Error('Expected a `reference` relationship field.')
  }

  return reference
}

/**
 * Helper: return the field names present in a `link()` group.
 */
function getFieldNames(linkGroup: LinkGroup): string[] {
  return collectFields(linkGroup)
    .map((field) => field.name)
    .filter((name): name is string => Boolean(name))
}

function getTypeField(linkGroup: LinkGroup): AnyField {
  const type = collectFields(linkGroup).find((field) => field.name === 'type')

  if (!type || type.type !== 'radio') {
    throw new Error('Expected a `type` radio field.')
  }

  return type
}

describe('link field factory', () => {
  describe('shared link validation', () => {
    it('trims text before persistence and rejects blank labels', () => {
      expect(trimText({ value: ' About ' } as never)).toBe('About')
      expect(trimText({ value: null } as never)).toBeNull()
      expect(validateNonBlankText(' About ')).toBe(true)
      expect(validateNonBlankText('   ')).toBeTypeOf('string')
    })

    it.each([
      'https://example.com/path',
      'http://example.com',
      '/about',
      '/',
      '#newsletter',
      'mailto:hello@example.com',
      'mailto:user@localhost',
      'tel:+1 (555) 123-4567',
    ])('accepts supported navigation URL %s', (url) => {
      expect(validateNavigationURL(url)).toBe(true)
    })

    it.each([
      '   ',
      'about us',
      '//example.com',
      'javascript:alert(1)',
      'mailto:hello',
      'mailto:@example.com',
      'mailto:a@example.com/evil',
      'mailto:a@example.com:bad',
      'mailto:a@example.com?subject=x',
      'mailto:a@example.com#fragment',
      'mailto:a@example.com,b@example.com',
      'mailto:a@example.com;b@example.com',
      'mailto:a@@example.com',
      'tel:call-me',
      'tel:   ',
    ])('rejects unsupported navigation URL %s', (url) => {
      expect(validateNavigationURL(url)).toBeTypeOf('string')
    })
  })

  describe('reference relationship target', () => {
    it('defaults the reference relationTo to pages and posts when none is passed', () => {
      const linkGroup = link()

      expect(linkGroup).toMatchObject({
        name: 'link',
        type: 'group',
      })

      expect(getReferenceField(linkGroup).relationTo).toEqual(['pages', 'posts'])
    })

    it('applies the full relationTo list when one is passed', () => {
      const linkGroup = link({
        relationTo: ['pages', 'posts', 'case-studies', 'categories'],
      })

      expect(getReferenceField(linkGroup).relationTo).toEqual([
        'pages',
        'posts',
        'case-studies',
        'categories',
      ])
    })

    it('preserves a scalar relationTo as a single relationship target', () => {
      const linkGroup = link({ relationTo: 'pages' })

      expect(getReferenceField(linkGroup).relationTo).toBe('pages')
    })
  })

  describe('optional field toggles', () => {
    it('gives reference and URL targets half width when a label is present', () => {
      const fields = collectFields(link())
      const reference = fields.find((field) => field.name === 'reference')
      const url = fields.find((field) => field.name === 'url')

      expect(reference).toMatchObject({ admin: { width: '50%' } })
      expect(url).toMatchObject({ admin: { width: '50%' } })
      expect((reference?.admin as { condition?: unknown })?.condition).toBeTypeOf('function')
      expect((url?.admin as { condition?: unknown })?.condition).toBeTypeOf('function')
    })

    it('keeps the link type optional by default', () => {
      expect(getTypeField(link()).required).toBeUndefined()
    })

    it('allows consumers to opt into a required link type', () => {
      expect(getTypeField(link({ typeOverrides: { required: true } })).required).toBe(true)
    })

    it('omits the appearance field when appearances is false', () => {
      const linkGroup = link({ appearances: false })

      expect(getFieldNames(linkGroup)).not.toContain('appearance')
    })

    it('omits the label field when disableLabel is true', () => {
      const linkGroup = link({ disableLabel: true })

      expect(getFieldNames(linkGroup)).not.toContain('label')
    })
  })
})
