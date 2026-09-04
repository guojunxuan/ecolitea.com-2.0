import { describe, expect, it } from 'vitest'

import { Footer } from '@/Footer/config'
import { revalidateFooter } from '@/Footer/hooks/revalidateFooter'
import {
  trimText,
  validateFooterColumnLabels,
  validateFooterNavigationLinks,
  validateFooterURL,
  validateNonBlankText,
} from '@/Footer/validation'
import { navigationColumns } from '@/fields/navigationColumns'

describe('navigationColumns field', () => {
  it('keeps its stable identity while merging top-level and nested overrides', () => {
    const columns = navigationColumns({
      overrides: {
        minRows: 2,
        admin: {
          description: 'Configured columns',
        },
      },
      navItemsOverrides: {
        maxRows: 7,
        admin: {
          components: {
            RowLabel: '@/Example#NavItemRowLabel',
          },
        },
      },
    })

    expect(columns).toMatchObject({
      name: 'columns',
      label: 'Navigation Columns',
      interfaceName: 'NavigationColumns',
      minRows: 2,
    })

    const navItems = columns.fields.find((field) => 'name' in field && field.name === 'navItems')

    expect(navItems).toMatchObject({
      name: 'navItems',
      maxRows: 7,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Example#NavItemRowLabel',
        },
      },
    })
  })
})

describe('Footer Global', () => {
  it('only exposes grouped navigation at the top level', () => {
    expect(Footer.slug).toBe('footer')
    expect(Footer.fields).toHaveLength(1)
    expect(Footer.fields.some((field) => 'name' in field && field.name === 'navItems')).toBe(false)
    expect(Footer.fields.some((field) => 'name' in field && field.name === 'columns')).toBe(true)
    expect(Footer.hooks?.afterChange).toEqual([revalidateFooter])
    expect(Footer.versions).toBe(false)
  })

  it('allows an empty footer while constraining named navigation columns', () => {
    const columns = Footer.fields.find((field) => 'name' in field && field.name === 'columns')

    expect(columns).toMatchObject({
      name: 'columns',
      type: 'array',
      label: 'Navigation Columns',
      labels: {
        singular: 'Navigation Column',
        plural: 'Navigation Columns',
      },
      maxRows: 4,
      interfaceName: 'NavigationColumns',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#ColumnRowLabel',
        },
      },
    })

    if (!columns || columns.type !== 'array') {
      throw new Error('Footer columns must be an array field.')
    }

    expect(columns.fields).toContainEqual(
      expect.objectContaining({
        name: 'label',
        type: 'text',
        label: 'Label',
        required: true,
      }),
    )

    expect(columns.required).not.toBe(true)
    expect(columns.minRows).toBeUndefined()
    expect(columns.validate).toBe(validateFooterColumnLabels)

    const label = columns.fields.find((field) => 'name' in field && field.name === 'label')
    if (!label || label.type !== 'text') throw new Error('Footer column label must be text.')
    expect(label.validate).toBe(validateNonBlankText)
    expect(label.hooks?.beforeChange).toEqual([trimText])
  })

  it('defines required grouped links within each footer column', () => {
    const columns = Footer.fields.find((field) => 'name' in field && field.name === 'columns')

    if (!columns || columns.type !== 'array') {
      throw new Error('Footer columns must be an array field.')
    }

    const navItems = columns.fields.find((field) => 'name' in field && field.name === 'navItems')

    expect(navItems).toMatchObject({
      name: 'navItems',
      type: 'array',
      label: 'Navigation Links',
      labels: {
        singular: 'Navigation Link',
        plural: 'Navigation Links',
      },
      required: true,
      minRows: 1,
      maxRows: 8,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#NavItemRowLabel',
        },
      },
    })

    if (!navItems || navItems.type !== 'array') {
      throw new Error('Footer column navigation items must be an array field.')
    }

    const link = navItems.fields.find((field) => 'name' in field && field.name === 'link')

    expect(link).toMatchObject({
      name: 'link',
      type: 'group',
    })

    if (!link || link.type !== 'group') {
      throw new Error('Footer navigation items must contain a link group.')
    }

    expect(link.fields.some((field) => 'name' in field && field.name === 'appearance')).toBe(false)

    const relationship = link.fields
      .filter((field) => field.type === 'row')
      .flatMap((field) => (field.type === 'row' ? field.fields : []))
      .find((field) => 'name' in field && field.name === 'reference')

    expect(relationship).toMatchObject({
      relationTo: ['pages', 'posts', 'case-studies', 'categories'],
    })
    expect(navItems.validate).toBe(validateFooterNavigationLinks)

    const linkFields = link.fields
      .filter((field) => field.type === 'row')
      .flatMap((field) => (field.type === 'row' ? field.fields : []))
    const url = linkFields.find((field) => 'name' in field && field.name === 'url')
    const label = linkFields.find((field) => 'name' in field && field.name === 'label')

    if (!url || url.type !== 'text' || !label || label.type !== 'text') {
      throw new Error('Footer navigation URL and label must be text fields.')
    }
    expect(url.validate).toBe(validateFooterURL)
    expect(url.hooks?.beforeChange).toEqual([trimText])
    expect(label.validate).toBe(validateNonBlankText)
    expect(label.hooks?.beforeChange).toEqual([trimText])
  })

  it('allows public reads but only authenticated updates', async () => {
    expect(Footer.access?.read?.({} as never)).toBe(true)
    expect(Footer.access?.update?.({ req: { user: null } } as never)).toBe(false)
    expect(Footer.access?.update?.({ req: { user: { id: 'user-1' } } } as never)).toBe(true)
  })
})
