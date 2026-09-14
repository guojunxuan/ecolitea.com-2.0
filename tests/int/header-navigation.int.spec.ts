import { describe, expect, it } from 'vitest'

import { Header } from '@/Header/config'
import { navigationItems } from '@/Header/fields/navigationItems'
import { normalizeHeader } from '@/Header/hooks/normalizeHeader'
import { revalidateHeader } from '@/Header/hooks/revalidateHeader'

describe('Header navigation configuration', () => {
  it('defines the primary item limit, labels, type choices, and active branch conditions', () => {
    const navItems = navigationItems()
    const label = navItems.fields.find((field) => 'name' in field && field.name === 'label')
    const navigationType = navItems.fields.find(
      (field) => 'name' in field && field.name === 'navigationType',
    )
    const link = navItems.fields.find((field) => 'name' in field && field.name === 'link')
    const content = navItems.fields.find((field) => 'name' in field && field.name === 'content')

    expect(navItems).toMatchObject({
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      interfaceName: 'HeaderNavItem',
      admin: { initCollapsed: true, components: { RowLabel: '@/Header/RowLabel#RowLabel' } },
    })
    expect(label).toMatchObject({ name: 'label', type: 'text', required: true })
    expect(navigationType).toMatchObject({
      name: 'navigationType',
      type: 'radio',
      required: true,
      defaultValue: 'directLink',
      admin: { layout: 'horizontal' },
      options: [
        { label: 'Direct Link', value: 'directLink' },
        { label: 'Dropdown', value: 'dropdown' },
        { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
      ],
    })
    expect(link).toMatchObject({ name: 'link', type: 'group', label: 'Direct Link' })
    expect(
      link && 'admin' in link
        ? link.admin?.condition?.({}, { navigationType: 'directLink' }, {} as never)
        : false,
    ).toBe(true)
    expect(
      link && 'admin' in link
        ? link.admin?.condition?.({}, { navigationType: 'dropdown' }, {} as never)
        : true,
    ).toBe(false)
    expect(content).toMatchObject({
      name: 'content',
      type: 'blocks',
      required: true,
      minRows: 1,
      maxRows: 12,
    })
  })

  it('retains the public-read/authenticated-update Global and conditional menu CTA', () => {
    expect(Header.slug).toBe('header')
    expect(Header.access?.read?.({} as never)).toBe(true)
    expect(Header.access?.update?.({ req: { user: null } } as never)).toBe(false)
    expect(Header.access?.update?.({ req: { user: { id: 'user-1' } } } as never)).toBe(true)

    const enableMenuCta = Header.fields.find(
      (field) => 'name' in field && field.name === 'enableMenuCta',
    )
    const menuCta = Header.fields.find((field) => 'name' in field && field.name === 'menuCta')

    expect(enableMenuCta).toMatchObject({ type: 'checkbox', defaultValue: false })
    expect(menuCta).toMatchObject({ name: 'menuCta', type: 'group', label: 'Menu CTA Button' })
    expect(
      menuCta && 'admin' in menuCta
        ? menuCta.admin?.condition?.({}, { enableMenuCta: false }, {} as never)
        : true,
    ).toBe(false)
    expect(
      menuCta && 'admin' in menuCta
        ? menuCta.admin?.condition?.({}, { enableMenuCta: true }, {} as never)
        : false,
    ).toBe(true)
  })

  it('normalizes before validation and revalidates after changes', () => {
    expect(Header.hooks?.beforeValidate).toEqual([normalizeHeader])
    expect(Header.hooks?.afterChange).toEqual([revalidateHeader])
    expect(Header.versions).toBe(false)
  })
})
