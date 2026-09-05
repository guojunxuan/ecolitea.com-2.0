import { describe, expect, it } from 'vitest'

import { Header } from '@/Header/config'
import { dropdown } from '@/Header/fields/dropdown'
import { dropdownItems } from '@/Header/fields/dropdownItems'
import { navigationItems } from '@/Header/fields/navigationItems'
import { validateHeaderNavItems } from '@/Header/validators/validateNavigation'
import { trimText, validateNavigationURL, validateNonBlankText } from '@/fields/linkValidation'

interface NestedField {
  fields?: NestedField[]
  name?: string
  required?: boolean
  type?: string
}

const collectNestedFields = (fields: NestedField[]): NestedField[] =>
  fields.flatMap((field) => [field, ...collectNestedFields(field.fields ?? [])])

const namedField = (fields: NestedField[], name: string): NestedField | undefined =>
  fields.find((field) => field.name === name)

const assertConfiguredLink = (group: NestedField, labeled: boolean) => {
  const fields = collectNestedFields(group.fields ?? [])
  expect(namedField(fields, 'type')).toMatchObject({ type: 'radio', required: true })
  expect(namedField(fields, 'url')).toMatchObject({
    validate: validateNavigationURL,
    hooks: { beforeChange: [trimText] },
  })

  if (labeled) {
    expect(namedField(fields, 'label')).toMatchObject({
      required: true,
      validate: validateNonBlankText,
      hooks: { beforeChange: [trimText] },
    })
  } else {
    expect(namedField(fields, 'label')).toBeUndefined()
  }
}

describe('navigationItems field (Task 2)', () => {
  it('requires the type discriminator in every Header link without changing shared defaults', () => {
    const navItems = navigationItems()
    if (navItems.type !== 'array') throw new Error('navigationItems must return an array field.')

    const allFields = collectNestedFields(navItems.fields as NestedField[])
    const linkGroups = allFields.filter(
      (field) => field.type === 'group' && (field.name === 'link' || field.name === 'landingLink'),
    )

    expect(linkGroups).toHaveLength(7)

    for (const linkGroup of linkGroups) {
      const linkType = collectNestedFields(linkGroup.fields ?? []).find(
        (field) => field.name === 'type' && field.type === 'radio',
      )
      expect(linkType).toMatchObject({ name: 'type', type: 'radio', required: true })
    }
  })

  it('configures every Header link category with opt-in validation and labeling', () => {
    const navItems = navigationItems()
    if (navItems.type !== 'array') throw new Error('navigationItems must return an array field.')

    const direct = namedField(navItems.fields as NestedField[], 'link')
    const dropdownGroup = namedField(navItems.fields as NestedField[], 'dropdown')
    if (!direct || !dropdownGroup) throw new Error('Expected direct and dropdown groups.')
    assertConfiguredLink(direct, false)

    const descriptionLinks = namedField(dropdownGroup.fields ?? [], 'descriptionLinks')
    const items = namedField(dropdownGroup.fields ?? [], 'items')
    const descriptionLink = namedField(descriptionLinks?.fields ?? [], 'link')
    if (!descriptionLink || !items)
      throw new Error('Expected description links and dropdown items.')
    assertConfiguredLink(descriptionLink, true)

    for (const groupName of ['defaultItem', 'featuredItem', 'listItem']) {
      const itemGroup = namedField(items.fields ?? [], groupName)
      if (!itemGroup) throw new Error(`Expected ${groupName}.`)

      if (groupName === 'defaultItem') {
        const defaultLink = namedField(itemGroup.fields ?? [], 'link')
        if (!defaultLink) throw new Error('Expected default link.')
        assertConfiguredLink(defaultLink, true)
        continue
      }

      const landing = namedField(itemGroup.fields ?? [], 'landingLink')
      const navigationLinks = namedField(itemGroup.fields ?? [], 'links')
      const navigationLink = namedField(navigationLinks?.fields ?? [], 'link')
      if (!landing || !navigationLink) throw new Error(`Expected links for ${groupName}.`)
      assertConfiguredLink(landing, false)
      assertConfiguredLink(navigationLink, true)
    }
  })

  it('defines the top-level navItems array with admin metadata', () => {
    const navItems = navigationItems()

    expect(navItems).toMatchObject({
      name: 'navItems',
      type: 'array',
      label: 'Navigation Items',
      labels: { singular: 'Navigation Item', plural: 'Navigation Items' },
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

  it('defines a normalized label and a horizontal navigation type radio', () => {
    const navItems = navigationItems()

    if (navItems.type !== 'array') {
      throw new Error('navigationItems must return an array field.')
    }

    expect(navItems.fields).toContainEqual(
      expect.objectContaining({
        name: 'label',
        type: 'text',
        required: true,
        validate: expect.any(Function),
        hooks: { beforeChange: [expect.any(Function)] },
      }),
    )

    const navigationType = navItems.fields.find(
      (field) => 'name' in field && field.name === 'navigationType',
    )

    expect(navigationType).toMatchObject({
      name: 'navigationType',
      type: 'radio',
      required: true,
      defaultValue: 'directLink',
      admin: { layout: 'horizontal' },
    })

    if (!navigationType || navigationType.type !== 'radio') {
      throw new Error('navigationType must be a radio field.')
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
      label: 'Direct Link',
    })

    if (!linkGroup || linkGroup.type !== 'group') {
      throw new Error('navItems must contain a direct link group.')
    }

    expect(linkGroup.fields.some((field) => 'name' in field && field.name === 'link')).toBe(false)

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

    expect(condition({} as never, { navigationType: 'directLink' } as never, {} as never)).toBe(
      true,
    )
    expect(
      condition({} as never, { navigationType: 'directLinkAndDropdown' } as never, {} as never),
    ).toBe(true)
    expect(condition({} as never, { navigationType: 'dropdown' } as never, {} as never)).toBe(false)
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

    const description = group.fields.find(
      (field) => 'name' in field && field.name === 'description',
    )
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
      label: 'Description Links',
      labels: { singular: 'Description Link', plural: 'Description Links' },
      maxRows: 3,
    })

    expect(items).toMatchObject({
      name: 'items',
      type: 'array',
      label: 'Dropdown Items',
      labels: { singular: 'Dropdown Item', plural: 'Dropdown Items' },
      required: true,
      minRows: 1,
      maxRows: 12,
      interfaceName: 'HeaderDropdownItem',
    })
  })
})

describe('dropdownItems field (Task 4)', () => {
  it('defines the items array with admin metadata and a default horizontal type radio', () => {
    const items = dropdownItems()

    expect(items).toMatchObject({
      name: 'items',
      type: 'array',
      label: 'Dropdown Items',
      labels: { singular: 'Dropdown Item', plural: 'Dropdown Items' },
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
      type: 'radio',
      required: true,
      defaultValue: 'default',
      admin: { layout: 'horizontal' },
    })

    if (!type || type.type !== 'radio') {
      throw new Error('items must contain a type radio field.')
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

    const content = featuredItem.fields.find((field) => 'name' in field && field.name === 'label')
    const links = featuredItem.fields.find((field) => 'name' in field && field.name === 'links')

    expect(content).toMatchObject({ name: 'label', type: 'richText', label: 'Content' })
    expect(links).toMatchObject({
      name: 'links',
      type: 'array',
      label: 'Navigation Links',
      labels: { singular: 'Navigation Link', plural: 'Navigation Links' },
      maxRows: 4,
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

    const links = listItem.fields.find((field) => 'name' in field && field.name === 'links')

    expect(links).toMatchObject({
      name: 'links',
      type: 'array',
      label: 'Navigation Links',
      labels: { singular: 'Navigation Link', plural: 'Navigation Links' },
      required: true,
      minRows: 1,
      maxRows: 8,
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

    expect(menuCta.fields.some((field) => 'name' in field && field.name === 'appearance')).toBe(
      false,
    )
  })

  it('keeps the existing Header access, hooks and versions settings', () => {
    expect(Header.access?.read).toBeTypeOf('function')
    expect(Header.hooks?.afterChange).toHaveLength(1)
    expect(Header.versions).toBe(false)
  })
})

describe('validateHeaderNavItems (Task 7)', () => {
  // A valid reference-link group (flat). Used directly for flat contexts —
  // `defaultItem.link` and `featuredItem`/`listItem` `landingLink` — and wrapped
  // in `{ link }` where the direct-link destination is nested (the row's `link`
  // group wraps a `link()` field that is also named `link`).
  const baseLink = {
    type: 'reference',
    reference: { relationTo: 'pages', value: 'some-page-id' },
  }

  const populatedBaseLink = {
    type: 'reference',
    reference: { relationTo: 'pages', value: { id: 'some-page-id', title: 'About' } },
  }

  const otherBaseLink = {
    type: 'reference',
    reference: { relationTo: 'pages', value: 'other-page-id' },
  }

  const customBaseLink = {
    type: 'custom',
    url: ' /about ',
  }

  it('accepts a valid directLink row with a nested link destination', () => {
    const items = [{ label: 'About', navigationType: 'directLink', link: { link: baseLink } }]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('accepts a valid dropdown row with a default item', () => {
    const items = [
      {
        label: 'Solutions',
        navigationType: 'dropdown',
        dropdown: {
          items: [{ type: 'default', defaultItem: { link: baseLink } }],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('accepts a hybrid directLinkAndDropdown row with both a link and items', () => {
    const items = [
      {
        label: 'Company',
        navigationType: 'directLinkAndDropdown',
        link: { link: baseLink },
        dropdown: {
          items: [{ type: 'default', defaultItem: { link: baseLink } }],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('accepts trimmed labels and destination identities across raw, populated and custom links', () => {
    const items = [
      {
        label: ' About ',
        navigationType: 'directLink',
        link: { link: baseLink },
      },
      {
        label: 'Contact',
        navigationType: 'directLink',
        link: { link: otherBaseLink },
      },
      {
        label: 'Docs',
        navigationType: 'dropdown',
        dropdown: {
          items: [
            { type: 'default', defaultItem: { link: customBaseLink } },
            {
              type: 'list',
              listItem: {
                tag: 'Resources',
                landingLink: populatedBaseLink,
                links: [{ link: otherBaseLink }],
              },
            },
          ],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('rejects a directLink row whose nested link has an empty destination', () => {
    const items = [{ label: 'About', navigationType: 'directLink', link: { link: {} } }]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('Direct Link')
  })

  it('rejects a dropdown row with an empty items array', () => {
    const items = [
      {
        label: 'Solutions',
        navigationType: 'dropdown',
        dropdown: { items: [] },
      },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('item')
  })

  it('rejects a hybrid row missing its direct link', () => {
    const items = [
      {
        label: 'Company',
        navigationType: 'directLinkAndDropdown',
        link: null,
        dropdown: {
          items: [{ type: 'default', defaultItem: { link: baseLink } }],
        },
      },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('Direct Link')
  })

  it('rejects labels that only differ by surrounding whitespace', () => {
    const items = [
      { label: 'About', navigationType: 'directLink', link: { link: baseLink } },
      { label: ' About ', navigationType: 'directLink', link: { link: populatedBaseLink } },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('Labels')
  })

  it('rejects two active direct links that resolve to the same destination', () => {
    const items = [
      { label: 'About', navigationType: 'directLink', link: { link: baseLink } },
      { label: 'About us', navigationType: 'directLink', link: { link: populatedBaseLink } },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('Direct Link')
  })

  it('allows a direct link to match its own dropdown target', () => {
    const items = [
      {
        label: 'About',
        navigationType: 'directLinkAndDropdown',
        link: { link: baseLink },
        dropdown: {
          items: [
            { type: 'default', defaultItem: { link: baseLink } },
            { type: 'default', defaultItem: { link: customBaseLink } },
          ],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('rejects duplicate destinations within a single dropdown', () => {
    const items = [
      {
        label: 'About',
        navigationType: 'dropdown',
        dropdown: {
          items: [
            { type: 'default', defaultItem: { link: baseLink } },
            { type: 'default', defaultItem: { link: populatedBaseLink } },
          ],
        },
      },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('dropdown')
  })

  it('allows different dropdown rows to reuse the same destination', () => {
    const items = [
      {
        label: 'About',
        navigationType: 'dropdown',
        dropdown: {
          items: [{ type: 'default', defaultItem: { link: baseLink } }],
        },
      },
      {
        label: 'Company',
        navigationType: 'dropdown',
        dropdown: {
          items: [{ type: 'default', defaultItem: { link: populatedBaseLink } }],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })

  it('rejects a featured item missing its tag', () => {
    const items = [
      {
        label: 'Solutions',
        navigationType: 'dropdown',
        dropdown: {
          items: [
            {
              type: 'featured',
              featuredItem: {
                tag: '',
                landingLink: baseLink,
              },
            },
          ],
        },
      },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('tag')
  })

  it('rejects a list item missing its landingLink destination', () => {
    const items = [
      {
        label: 'Solutions',
        navigationType: 'dropdown',
        dropdown: {
          items: [
            {
              type: 'list',
              listItem: {
                tag: 'Resources',
                landingLink: null,
              },
            },
          ],
        },
      },
    ]

    const result = validateHeaderNavItems(items)

    expect(result).not.toBe(true)
    expect(String(result)).toContain('Landing Link')
  })

  it('ignores a stale dropdown on a directLink row', () => {
    const items = [
      {
        label: 'About',
        navigationType: 'directLink',
        link: { link: baseLink },
        dropdown: {
          items: [
            {
              type: 'featured',
              featuredItem: {
                tag: '',
                landingLink: null,
              },
            },
          ],
        },
      },
    ]

    expect(validateHeaderNavItems(items)).toBe(true)
  })
})
