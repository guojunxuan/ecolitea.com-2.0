import type { GlobalBeforeValidateHook } from 'payload'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const trim = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

const normalizeLink = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    label: trim(value.label),
    url: trim(value.url),
  }
}

const normalizeLinkRow = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    link: normalizeLink(value.link),
  }
}

const normalizeLinkRows = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(normalizeLinkRow) : value

const normalizeDropdownItem = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  const defaultItem = isRecord(value.defaultItem)
    ? {
        ...value.defaultItem,
        link: normalizeLink(value.defaultItem.link),
      }
    : value.defaultItem
  const featuredItem = isRecord(value.featuredItem)
    ? {
        ...value.featuredItem,
        tag: trim(value.featuredItem.tag),
        landingLink: normalizeLink(value.featuredItem.landingLink),
        links: normalizeLinkRows(value.featuredItem.links),
      }
    : value.featuredItem
  const listItem = isRecord(value.listItem)
    ? {
        ...value.listItem,
        tag: trim(value.listItem.tag),
        landingLink: normalizeLink(value.listItem.landingLink),
        links: normalizeLinkRows(value.listItem.links),
      }
    : value.listItem

  return { ...value, defaultItem, featuredItem, listItem }
}

const normalizeDropdown = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    descriptionLinks: normalizeLinkRows(value.descriptionLinks),
    items: Array.isArray(value.items) ? value.items.map(normalizeDropdownItem) : value.items,
  }
}

const normalizeNavigationItem = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    label: trim(value.label),
    link: normalizeLink(value.link),
    dropdown: normalizeDropdown(value.dropdown),
  }
}

export const normalizeHeader: GlobalBeforeValidateHook = ({ data }) => {
  if (!isRecord(data)) return data

  return {
    ...data,
    navItems: Array.isArray(data.navItems)
      ? data.navItems.map(normalizeNavigationItem)
      : data.navItems,
    menuCta: normalizeLink(data.menuCta),
  }
}
