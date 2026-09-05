export type HeaderLinkValue = {
  type?: 'reference' | 'custom' | null
  reference?: { relationTo?: string | null; value?: unknown } | null
  url?: string | null
}

export type HeaderDropdownItemValue = {
  type?: 'default' | 'featured' | 'list' | null
  defaultItem?: { link?: HeaderLinkValue; description?: string | null } | null
  featuredItem?: {
    tag?: string | null
    landingLink?: HeaderLinkValue
    label?: unknown
    links?: unknown
  } | null
  listItem?: { tag?: string | null; landingLink?: HeaderLinkValue; links?: unknown } | null
}

export type HeaderNavItemValue = {
  label?: string | null
  navigationType?: 'directLink' | 'dropdown' | 'directLinkAndDropdown' | null
  link?: { link?: HeaderLinkValue } | null
  dropdown?: {
    description?: string | null
    descriptionLinks?: unknown
    items?: HeaderDropdownItemValue[] | null
  } | null
}

const trimString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getRelationId = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return null

  const record = value as { id?: unknown; _id?: unknown }
  if (typeof record.id === 'string') return record.id
  if (typeof record._id === 'string') return record._id
  return null
}

export const getDestinationKey = (link?: HeaderLinkValue | null): string | null => {
  if (!link) return null

  if (link.type === 'reference') {
    const relationTo = trimString(link.reference?.relationTo)
    const id = getRelationId(link.reference?.value)
    return relationTo && id ? `reference:${relationTo}:${id}` : null
  }

  if (link.type === 'custom') {
    const url = trimString(link.url)
    return url ? `custom:${url}` : null
  }

  return null
}

const getNestedDirectLink = (item: HeaderNavItemValue): HeaderLinkValue | null => item?.link?.link ?? null

const formatRow = (label: string | null, index: number): string =>
  `${label ? `"${label}"` : '(untitled item)'} (row ${index})`

const formatDropdownRow = (label: string | null, rowIndex: number, itemIndex: number): string =>
  `${label ? `"${label}"` : '(untitled item)'} (row ${rowIndex}, item ${itemIndex})`

const validateDropdownItem = (
  label: string | null,
  rowIndex: number,
  itemIndex: number,
  item: HeaderDropdownItemValue,
): string | null => {
  if (item.type === 'featured') {
    const tag = trimString(item.featuredItem?.tag)
    if (!tag) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (featured): A tag is required.`
    }
    if (!getDestinationKey(item.featuredItem?.landingLink)) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (featured, tag: "${tag}"): A "Landing Link" destination is required.`
    }
    return null
  }

  if (item.type === 'list') {
    const tag = trimString(item.listItem?.tag)
    if (!tag) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (list): A tag is required.`
    }
    if (!getDestinationKey(item.listItem?.landingLink)) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (list, tag: "${tag}"): A "Landing Link" destination is required.`
    }
  }

  return null
}

const validateDropdownScope = (
  label: string | null,
  rowIndex: number,
  items: HeaderDropdownItemValue[],
  rowDirectKey: string | null,
): string | null => {
  const seen = new Set<string>()

  for (const [itemOffset, item] of items.entries()) {
    const itemIndex = itemOffset + 1
    const activeKeys: string[] = []

    if (item.type === 'default') {
      const linkKey = getDestinationKey(item.defaultItem?.link)
      if (linkKey) activeKeys.push(linkKey)
    }

    if (item.type === 'featured') {
      const landingKey = getDestinationKey(item.featuredItem?.landingLink)
      if (landingKey) activeKeys.push(landingKey)
    }

    if (item.type === 'list') {
      const landingKey = getDestinationKey(item.listItem?.landingLink)
      if (landingKey) activeKeys.push(landingKey)
    }

    for (const activeKey of activeKeys) {
      if (activeKey === rowDirectKey) continue
      if (seen.has(activeKey)) {
        return `${formatDropdownRow(label, rowIndex, itemIndex)}: Duplicate destination within this dropdown.`
      }
      seen.add(activeKey)
    }

    const validationError = validateDropdownItem(label, rowIndex, itemIndex, item)
    if (validationError) return validationError

    const nestedLinks =
      item.type === 'featured'
        ? item.featuredItem?.links
        : item.type === 'list'
          ? item.listItem?.links
          : null

    if (!Array.isArray(nestedLinks)) continue

    for (const [nestedOffset, nestedItem] of nestedLinks.entries()) {
      const nestedIndex = nestedOffset + 1
      const nestedKey = getDestinationKey((nestedItem as { link?: HeaderLinkValue } | null | undefined)?.link)
      if (!nestedKey || nestedKey === rowDirectKey) continue
      if (seen.has(nestedKey)) {
        return `${formatDropdownRow(label, rowIndex, itemIndex)} navigation link ${nestedIndex}: Duplicate destination within this dropdown.`
      }
      seen.add(nestedKey)
    }
  }

  return null
}

// `ArrayFieldValidation` is `(value: null | unknown[] | undefined, options) => …`.
export const validateHeaderNavItems = (items?: unknown[] | null): string | true => {
  if (!items) return true
  if (!Array.isArray(items)) return 'navItems must be an array.'

  const seenLabels = new Set<string>()
  const seenDirectKeys = new Set<string>()

  for (const [offset, rawItem] of items.entries()) {
    const item = rawItem as HeaderNavItemValue | null | undefined
    const rowIndex = offset + 1
    const label = trimString(item?.label)
    const navigationType = item?.navigationType
    const directLink = getNestedDirectLink(item ?? {})
    const directKey = getDestinationKey(directLink)
    const dropdownItems = item?.dropdown?.items
    const hasDirect = navigationType === 'directLink' || navigationType === 'directLinkAndDropdown'
    const hasDropdown = navigationType === 'dropdown' || navigationType === 'directLinkAndDropdown'

    if (!label) {
      return `${formatRow(label, rowIndex)}: A label is required.`
    }

    if (seenLabels.has(label)) {
      return `${formatRow(label, rowIndex)}: Labels must be unique after trimming.`
    }
    seenLabels.add(label)

    if (hasDirect) {
      if (!directKey) {
        return `${formatRow(label, rowIndex)} (${navigationType}): A "Direct Link" destination is required.`
      }
      if (seenDirectKeys.has(directKey)) {
        return `${formatRow(label, rowIndex)} (${navigationType}): Active Direct Link destinations must be unique.`
      }
      seenDirectKeys.add(directKey)
    }

    if (hasDropdown) {
      if (!Array.isArray(dropdownItems) || dropdownItems.length < 1 || dropdownItems.length > 12) {
        return `${formatRow(label, rowIndex)} (${navigationType}): Dropdown items must contain 1 to 12 entries.`
      }

      const dropdownError = validateDropdownScope(label, rowIndex, dropdownItems, directKey)
      if (dropdownError) return dropdownError
    }
  }

  return true
}
