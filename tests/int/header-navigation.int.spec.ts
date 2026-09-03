import { describe, expect, it } from 'vitest'

import { Header } from '@/Header/config'
import { dropdown } from '@/Header/fields/dropdown'
import { dropdownItems } from '@/Header/fields/dropdownItems'
import { navigationItems } from '@/Header/fields/navigationItems'

describe('navigationItems field (Task 2)', () => {
  it('defines the top-level navItems array with admin metadata', () => {
    const navItems = navigationItems()

    expect(navItems).toMatchObject({
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      interfaceName: 'HeaderNavItem',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
    })
  })

  it('defines a required label text field and a required navigationType select', () => {
    const navItems = navigationItems()

    if (navItems.type !== 'array') {
      throw new Error('navigationItems must return an array field.')
    }

    expect(navItems.fields).toContainEqual(
      expect.objectContaining({
        name: 'label',
        type: 'text',
        required: true,
      }),
    )

    const navigationType = navItems.fields.find(
      (field) => 'name' in field && field.name === 'navigationType',
    )

    expect(navigationType).toMatchObject({
      name: 'navigationType',
      type: 'select',
      required: true,
      defaultValue: 'directLink',
    })

    if (!navigationType || navigationType.type !== 'select') {
      throw new Error('navigationType must be a select field.')
    }

    expect(navigationType.options).toEqual([
      { label: 'Direct Link', value: 'directLink' },
      { label: 'Dropdown', value: 'dropdown' },
      { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
    ])
  })

  it('defines a link group and a dropdown group within navItems', () => {
    const navItems = navigationItems()

    if (navItems.type !== 'array') {
      throw new Error('navigationItems must return an array field.')
    }

    const linkGroup = navItems.fields.find((field) => 'name' in field && field.name === 'link')
    const dropdownGroup = navItems.fields.find(
      (field) => 'name' in field && field.name === 'dropdown',
    )

    expect(linkGroup).toMatchObject({
      name: 'link',
      type: 'group',
    })

    expect(dropdownGroup).toMatchObject({
      name: 'dropdown',
      type: 'group',
    })
  })
})

describe('link group condition (Task 5)', () => {
  it('shows the link group for directLink and directLinkAndDropdown, hides for dropdown', () => {
    const navItems = navigationItems()

    if (navItems.type !== 'array') {
      throw new Error('navigationItems must return an array field.')
    }

    const linkGroup = navItems.fields.find((field) => 'name' in field && field.name === 'link')

    if (!linkGroup || linkGroup.type !== 'group') {
      throw new Error('navItems must contain a link group.')
    }

    const condition = linkGroup.admin?.condition

    expect(condition).toBeTypeOf('function')

    if (!condition) {
      throw new Error('The link group must define an admin.condition function.')
    }

    expect(
      condition({} as never, { navigationType: 'directLink' } as never, {} as never),
    ).toBe(true)
    expect(
      condition({} as never, { navigationType: 'directLinkAndDropdown' } as never, {} as never),
    ).toBe(true)
    expect(
      condition({} as never, { navigationType: 'dropdown' } as never, {} as never),
    ).toBe(false)
  })
})

describe('dropdown group (Task 3)', () => {
  it('defines a dropdown group with description, descriptionLinks and items', () => {
    const group = dropdown()

    expect(group).toMatchObject({
      name: 'dropdown',
      type: 'group',
    })

    expect(group.admin?.condition).toBeTypeOf('function')

    if (group.type !== 'group') {
      throw new Error('dropdown must return a group field.')
    }

    const description = group.fields.find((field) => 'name' in field && field.name === 'description')
    const descriptionLinks = group.fields.find(
      (field) => 'name' in field && field.name === 'descriptionLinks',
    )
    const items = group.fields.find((field) => 'name' in field && field.name === 'items')

    expect(description).toMatchObject({
      name: 'description',
      type: 'textarea',
      label: 'Description',
    })

    expect(descriptionLinks).toMatchObject({
      name: 'descriptionLinks',
      type: 'array',
      label: 'Description links',
    })

    expect(items).toMatchObject({
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 12,
      interfaceName: 'HeaderDropdownItem',
    })
  })
})

describe('dropdownItems field (Task 4)', () => {
  it('defines the items array with admin metadata and a required type select', () => {
    const items = dropdownItems()

    expect(items).toMatchObject({
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 12,
      interfaceName: 'HeaderDropdownItem',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/DropdownItemRowLabel#DropdownItemRowLabel',
        },
      },
    })

    if (items.type !== 'array') {
      throw new Error('dropdownItems must return an array field.')
    }

    const type = items.fields.find((field) => 'name' in field && field.name === 'type')

    expect(type).toMatchObject({
      name: 'type',
      type: 'select',
      required: true,
    })

    if (!type || type.type !== 'select') {
      throw new Error('items must contain a type select field.')
    }

    expect(type.options).toEqual([
      { label: 'Default', value: 'default' },
      { label: 'Featured', value: 'featured' },
      { label: 'List', value: 'list' },
    ])
  })

  it('defines a defaultItem group with a link group and a description textarea', () => {
    const items = dropdownItems()

    if (items.type !== 'array') {
      throw new Error('dropdownItems must return an array field.')
    }

    const defaultItem = items.fields.find(
      (field) => 'name' in field && field.name === 'defaultItem',
    )

    expect(defaultItem).toMatchObject({
      name: 'defaultItem',
      type: 'group',
    })

    if (!defaultItem || defaultItem.type !== 'group') {
      throw new Error('items must contain a defaultItem group.')
    }

    const link = defaultItem.fields.find((field) => 'name' in field && field.name === 'link')
    const description = defaultItem.fields.find(
      (field) => 'name' in field && field.name === 'description',
    )

    expect(link).toMatchObject({ name: 'link', type: 'group' })
    expect(description).toMatchObject({ name: 'description', type: 'textarea' })
  })

  it('defines a featuredItem group with a required tag and a landingLink group', () => {
    const items = dropdownItems()

    if (items.type !== 'array') {
      throw new Error('dropdownItems must return an array field.')
    }

    const featuredItem = items.fields.find(
      (field) => 'name' in field && field.name === 'featuredItem',
    )

    expect(featuredItem).toMatchObject({
      name: 'featuredItem',
      type: 'group',
    })

    if (!featuredItem || featuredItem.type !== 'group') {
      throw new Error('items must contain a featuredItem group.')
    }

    const tag = featuredItem.fields.find((field) => 'name' in field && field.name === 'tag')
    const landingLink = featuredItem.fields.find(
      (field) => 'name' in field && field.name === 'landingLink',
    )

    expect(tag).toMatchObject({ name: 'tag', type: 'text', required: true })
    expect(landingLink).toMatchObject({
      name: 'landingLink',
      type: 'group',
      label: 'Landing Link',
    })
  })

  it('defines a listItem group with a required tag and a landingLink group', () => {
    const items = dropdownItems()

    if (items.type !== 'array') {
      throw new Error('dropdownItems must return an array field.')
    }

    const listItem = items.fields.find((field) => 'name' in field && field.name === 'listItem')

    expect(listItem).toMatchObject({
      name: 'listItem',
      type: 'group',
    })

    if (!listItem || listItem.type !== 'group') {
      throw new Error('items must contain a listItem group.')
    }

    const tag = listItem.fields.find((field) => 'name' in field && field.name === 'tag')
    const landingLink = listItem.fields.find(
      (field) => 'name' in field && field.name === 'landingLink',
    )

    expect(tag).toMatchObject({ name: 'tag', type: 'text', required: true })
    expect(landingLink).toMatchObject({
      name: 'landingLink',
      type: 'group',
      label: 'Landing Link',
    })
  })
})

describe('Header Global (Task 6)', () => {
  it('exposes navigationItems and a menuCta field with no appearance selector', () => {
    expect(Header.slug).toBe('header')

    const navItems = Header.fields.find((field) => 'name' in field && field.name === 'navItems')

    expect(navItems).toMatchObject({
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      interfaceName: 'HeaderNavItem',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Header/RowLabel#RowLabel',
        },
      },
    })

    const menuCta = Header.fields.find((field) => 'name' in field && field.name === 'menuCta')

    expect(menuCta).toMatchObject({
      name: 'menuCta',
      type: 'group',
      label: 'Menu CTA Button',
    })

    if (!menuCta || menuCta.type !== 'group') {
      throw new Error('Header must contain a menuCta group.')
    }

    expect(menuCta.fields.some((field) => 'name' in field && field.name === 'appearance')).toBe(false)
  })

  it('keeps the existing Header access, hooks and versions settings', () => {
    expect(Header.access?.read).toBeTypeOf('function')
    expect(Header.hooks?.afterChange).toHaveLength(1)
    expect(Header.versions).toBe(false)
  })
})
