import { describe, expect, it } from 'vitest'

import { navigationItems } from '@/Header/fields/navigationItems'

type FieldShape = {
  admin?: {
    condition?: (data: unknown, siblingData: Record<string, unknown>) => boolean
  }
  blocks?: BlockShape[]
  filterOptions?: unknown
  fields?: FieldShape[]
  interfaceName?: string
  maxRows?: number
  minRows?: number
  name?: string
  required?: boolean
  slug?: string
  type?: string
  validate?: (value?: unknown) => string | true
}

type BlockShape = FieldShape & {
  fields: FieldShape[]
  interfaceName: string
  slug: string
}

const findNamed = (fields: FieldShape[], name: string): FieldShape | undefined =>
  fields.find((field) => field.name === name)

const fieldsWithin = (field: FieldShape | undefined): FieldShape[] => field?.fields ?? []

const linkHasLabel = (field: FieldShape | undefined): boolean =>
  fieldsWithin(field).some(
    (child) =>
      child.name === 'label' ||
      (child.type === 'row' && fieldsWithin(child).some((nested) => nested.name === 'label')),
  )

describe('Header navigation Blocks', () => {
  const navItems = navigationItems()
  const content = findNamed(navItems.fields as FieldShape[], 'content')

  it('stores dropdown content as the four agreed native Blocks', () => {
    expect(content).toMatchObject({
      name: 'content',
      type: 'blocks',
      required: true,
      minRows: 1,
      maxRows: 12,
    })

    expect(content?.blocks?.map(({ interfaceName, slug }) => ({ interfaceName, slug }))).toEqual([
      { interfaceName: 'HeaderCategoryTabsBlock', slug: 'categoryTabs' },
      { interfaceName: 'HeaderCardGroupBlock', slug: 'cardGroup' },
      { interfaceName: 'HeaderLinkGroupBlock', slug: 'linkGroup' },
      { interfaceName: 'HeaderRichCardBlock', slug: 'richCard' },
    ])
    expect(content?.admin?.condition?.({}, { navigationType: 'directLink' })).toBe(false)
    expect(content?.admin?.condition?.({}, { navigationType: 'dropdown' })).toBe(true)
    expect(content?.admin?.condition?.({}, { navigationType: 'directLinkAndDropdown' })).toBe(true)
  })

  it('defines Category Tabs with block/category CTAs and unlabeled card links', () => {
    const block = content?.blocks?.find(({ slug }) => slug === 'categoryTabs')
    const categories = findNamed(fieldsWithin(block), 'categories')
    const categoryFields = fieldsWithin(categories)
    const items = findNamed(categoryFields, 'items')
    const itemFields = fieldsWithin(items)

    expect(categories).toMatchObject({ type: 'array', required: true, minRows: 1, maxRows: 6 })
    expect(findNamed(fieldsWithin(block), 'cta')).toMatchObject({ type: 'group' })
    expect(findNamed(categoryFields, 'cta')).toMatchObject({ type: 'group' })
    expect(items).toMatchObject({ type: 'array', required: true, minRows: 1, maxRows: 8 })
    expect(findNamed(itemFields, 'image')).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      required: true,
    })
    expect(findNamed(itemFields, 'image')?.filterOptions).toMatchObject({
      mimeType: { in: expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp']) },
    })
    expect(findNamed(itemFields, 'title')).toMatchObject({ type: 'text', required: true })
    expect(findNamed(itemFields, 'title')?.validate?.('   ')).toBe('Please enter a title.')
    expect(findNamed(categoryFields, 'label')?.validate?.('   ')).toBe(
      'Please enter a category label.',
    )
    expect(linkHasLabel(findNamed(itemFields, 'link'))).toBe(false)
  })

  it('keeps Card Group card links unlabeled and its heading conditional', () => {
    const block = content?.blocks?.find(({ slug }) => slug === 'cardGroup')
    const items = findNamed(fieldsWithin(block), 'items')

    expect(findNamed(fieldsWithin(block), 'enableHeading')).toMatchObject({
      type: 'checkbox',
    })
    expect(findNamed(fieldsWithin(block), 'heading')).toMatchObject({
      type: 'text',
      required: true,
    })
    const heading = findNamed(fieldsWithin(block), 'heading')
    expect(heading?.admin?.condition?.({}, { enableHeading: false })).toBe(false)
    expect(heading?.admin?.condition?.({}, { enableHeading: true })).toBe(true)
    expect(heading?.validate?.('   ')).toBe('Please enter a heading.')
    const cta = findNamed(fieldsWithin(block), 'cta')
    expect(cta?.admin?.condition?.({}, { enableCta: false })).toBe(false)
    expect(cta?.admin?.condition?.({}, { enableCta: true })).toBe(true)
    expect(items).toMatchObject({ type: 'array', required: true, minRows: 1, maxRows: 8 })
    expect(linkHasLabel(findNamed(fieldsWithin(items), 'link'))).toBe(false)
  })

  it('uses labeled links for Link Group and an optional description for Rich Card', () => {
    const linkGroup = content?.blocks?.find(({ slug }) => slug === 'linkGroup')
    const links = findNamed(fieldsWithin(linkGroup), 'links')
    const richCard = content?.blocks?.find(({ slug }) => slug === 'richCard')

    expect(links).toMatchObject({ type: 'array', required: true, minRows: 1, maxRows: 8 })
    expect(linkHasLabel(findNamed(fieldsWithin(links), 'link'))).toBe(true)
    const description = findNamed(fieldsWithin(richCard), 'description')
    expect(findNamed(fieldsWithin(richCard), 'image')).toMatchObject({
      type: 'upload',
      relationTo: 'media',
      required: true,
    })
    expect(findNamed(fieldsWithin(richCard), 'title')).toMatchObject({
      type: 'text',
      required: true,
    })
    expect(description).toMatchObject({ type: 'textarea' })
    expect(description?.required).toBeUndefined()
    expect(linkHasLabel(findNamed(fieldsWithin(richCard), 'link'))).toBe(false)
  })
})
