import { describe, expect, it } from 'vitest'

import { Footer } from '@/Footer/config'
import { revalidateFooter } from '@/Footer/hooks/revalidateFooter'

describe('Footer Global', () => {
  it('only exposes grouped navigation at the top level', () => {
    expect(Footer.slug).toBe('footer')
    expect(Footer.fields).toHaveLength(1)
    expect(Footer.fields.some((field) => 'name' in field && field.name === 'navItems')).toBe(false)
    expect(Footer.fields.some((field) => 'name' in field && field.name === 'columns')).toBe(true)
    expect(Footer.hooks?.afterChange).toEqual([revalidateFooter])
    expect(Footer.versions).toBe(false)
  })

  it('defines required footer columns with a required label', () => {
    const columns = Footer.fields.find((field) => 'name' in field && field.name === 'columns')

    expect(columns).toMatchObject({
      name: 'columns',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 4,
      interfaceName: 'NavigationColumn',
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
        required: true,
      }),
    )
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
  })
})
