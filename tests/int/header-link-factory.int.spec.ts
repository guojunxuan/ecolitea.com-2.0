import { describe, expect, it } from 'vitest'

import { link } from '@/fields/link'

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

describe('link field factory', () => {
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
  })

  describe('optional field toggles', () => {
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
