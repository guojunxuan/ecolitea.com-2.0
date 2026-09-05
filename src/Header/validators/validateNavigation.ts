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
  link?: HeaderLinkValue | null
  dropdown?: {
    description?: string | null
    descriptionLinks?: Array<{ link?: HeaderLinkValue | null }> | null
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
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (!value || typeof value !== 'object') return null

  const record = value as { id?: unknown; _id?: unknown }
  if (typeof record.id === 'string') return record.id
  if (typeof record.id === 'number' && Number.isFinite(record.id)) return String(record.id)
  if (typeof record._id === 'string') return record._id
  if (typeof record._id === 'number' && Number.isFinite(record._id)) return String(record._id)
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
  if (item.type === 'default') {
    if (!getDestinationKey(item.defaultItem?.link)) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (default): A destination is required.`
    }
    return null
  }

  if (item.type === 'featured') {
    const tag = trimString(item.featuredItem?.tag)
    if (!tag) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (featured): A tag is required.`
    }
    if (!getDestinationKey(item.featuredItem?.landingLink)) {
      return `${formatDropdownRow(label, rowIndex, itemIndex)} (featured, tag: "${tag}"): A "Landing Link" destination is required.`
    }
    if (Array.isArray(item.featuredItem?.links)) {
      for (const [nestedOffset, nestedItem] of item.featuredItem.links.entries()) {
        const nestedIndex = nestedOffset + 1
        if (!getDestinationKey((nestedItem as { link?: HeaderLinkValue } | null | undefined)?.link)) {
          return `${formatDropdownRow(label, rowIndex, itemIndex)} navigation link ${nestedIndex}: A destination is required.`
        }
      }
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
    if (Array.isArray(item.listItem?.links)) {
      for (const [nestedOffset, nestedItem] of item.listItem.links.entries()) {
        const nestedIndex = nestedOffset + 1
        if (!getDestinationKey((nestedItem as { link?: HeaderLinkValue } | null | undefined)?.link)) {
          return `${formatDropdownRow(label, rowIndex, itemIndex)} navigation link ${nestedIndex}: A destination is required.`
        }
      }
    }
  }

  return null
}

const validateDropdownScope = (
  label: string | null,
  rowIndex: number,
  items: HeaderDropdownItemValue[],
): string | null => {
  const seen = new Set<string>()

  const addKey = (key: string | null, context: string): string | null => {
    if (!key) return null
    if (seen.has(key)) {
      return `${context}: Duplicate destination within this dropdown.`
    }
    seen.add(key)
    return null
  }

  for (const [itemOffset, item] of items.entries()) {
    const itemIndex = itemOffset + 1

    const validationError = validateDropdownItem(label, rowIndex, itemIndex, item)
    if (validationError) return validationError

    const descriptionLinks =
      item.type === 'default'
        ? item.defaultItem?.description ? [] : null
        : item.type === 'featured'
          ? item.featuredItem?.links
          : item.type === 'list'
            ? item.listItem?.links
            : null
    if (item.type === 'default') {
      const defaultKey = getDestinationKey(item.defaultItem?.link)
      const defaultError = addKey(
        defaultKey,
        `${formatDropdownRow(label, rowIndex, itemIndex)} (default)`,
      )
      if (defaultError) return defaultError
    }

    const landingKey =
      item.type === 'featured'
        ? getDestinationKey(item.featuredItem?.landingLink)
        : item.type === 'list'
          ? getDestinationKey(item.listItem?.landingLink)
          : null
    if (item.type === 'featured' || item.type === 'list') {
      const landingError = addKey(
        landingKey,
        `${formatDropdownRow(label, rowIndex, itemIndex)} (${item.type})`,
      )
      if (landingError) return landingError
    }

    if (item.type === 'list') {
      if (!Array.isArray(item.listItem?.links) || item.listItem.links.length < 1 || item.listItem.links.length > 8) {
        return `${formatDropdownRow(label, rowIndex, itemIndex)} (list): Navigation Links must contain 1 to 8 entries.`
      }
    }

    if (descriptionLinks) {
      for (const [nestedOffset, nestedItem] of descriptionLinks.entries()) {
        const nestedIndex = nestedOffset + 1
        const nestedKey = getDestinationKey(nestedItem?.link ?? null)
        const nestedError = addKey(
          nestedKey,
          `${formatDropdownRow(label, rowIndex, itemIndex)} description link ${nestedIndex}`,
        )
        if (nestedError) return nestedError
      }
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
    const directKey = getDestinationKey(item?.link ?? null)
    const dropdownItems = item?.dropdown?.items
    const descriptionLinks = item?.dropdown?.descriptionLinks
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

      const dropdownError = validateDropdownScope(label, rowIndex, dropdownItems)
      if (dropdownError) return dropdownError
    }

    if (Array.isArray(descriptionLinks)) {
      const seenDescription = new Set<string>()
      for (const [linkOffset, descriptionLink] of descriptionLinks.entries()) {
        const linkIndex = linkOffset + 1
        const key = getDestinationKey(descriptionLink?.link ?? null)
        if (!key) continue
        if (seenDescription.has(key)) {
          return `${formatDropdownRow(label, rowIndex, linkIndex)} (description link): Duplicate destination within this dropdown.`
        }
        seenDescription.add(key)
      }
    }
  }

  return true
}
