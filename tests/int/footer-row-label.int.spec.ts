import { describe, expect, it } from 'vitest'

import { getColumnRowLabel, getNavItemRowLabel } from '@/Footer/rowLabels'

describe('Footer row labels', () => {
  it('uses the column label or a numbered fallback', () => {
    expect(getColumnRowLabel({ label: ' Products ' }, 0)).toBe('Products')
    expect(getColumnRowLabel({ label: ' ' }, 1)).toBe('Navigation Column 02')
  })

  it('uses the first meaningful navigation-link value', () => {
    expect(getNavItemRowLabel({ link: { label: ' About ' } }, 0)).toBe('About')
    expect(
      getNavItemRowLabel(
        { link: { reference: { relationTo: 'pages', value: { id: '1', title: 'Story' } } } },
        1,
      ),
    ).toBe('Story')
    expect(getNavItemRowLabel({ link: { url: ' /contact ' } }, 2)).toBe('/contact')
    expect(
      getNavItemRowLabel({ link: { reference: { relationTo: 'pages', value: '1' } } }, 3),
    ).toBe('Navigation Link 04')
  })
})
