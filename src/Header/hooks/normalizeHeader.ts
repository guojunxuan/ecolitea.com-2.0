import type { GlobalBeforeValidateHook } from 'payload'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (value: UnknownRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const trim = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value)

const normalizeLink = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    ...(hasOwn(value, 'label') ? { label: trim(value.label) } : {}),
    ...(hasOwn(value, 'url') ? { url: trim(value.url) } : {}),
  }
}

const normalizeLinkRow = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  return { ...value, ...(hasOwn(value, 'link') ? { link: normalizeLink(value.link) } : {}) }
}

const normalizeLinkRows = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(normalizeLinkRow) : value

const normalizeCardItem = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  return {
    ...value,
    ...(hasOwn(value, 'title') ? { title: trim(value.title) } : {}),
    ...(hasOwn(value, 'link') ? { link: normalizeLink(value.link) } : {}),
  }
}

const normalizeCardItems = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(normalizeCardItem) : value

const normalizeCategory = (value: unknown): unknown => {
  if (!isRecord(value)) return value
  return {
    ...value,
    ...(hasOwn(value, 'label') ? { label: trim(value.label) } : {}),
    ...(hasOwn(value, 'cta') ? { cta: normalizeLink(value.cta) } : {}),
    ...(hasOwn(value, 'items') ? { items: normalizeCardItems(value.items) } : {}),
  }
}

const normalizeBlock = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  switch (value.blockType) {
    case 'categoryTabs':
      return {
        ...value,
        ...(hasOwn(value, 'cta') ? { cta: normalizeLink(value.cta) } : {}),
        ...(hasOwn(value, 'categories')
          ? {
              categories: Array.isArray(value.categories)
                ? value.categories.map(normalizeCategory)
                : value.categories,
            }
          : {}),
      }
    case 'cardGroup':
      return {
        ...value,
        ...(hasOwn(value, 'heading') ? { heading: trim(value.heading) } : {}),
        ...(hasOwn(value, 'cta') ? { cta: normalizeLink(value.cta) } : {}),
        ...(hasOwn(value, 'items') ? { items: normalizeCardItems(value.items) } : {}),
      }
    case 'linkGroup':
      return {
        ...value,
        ...(hasOwn(value, 'heading') ? { heading: trim(value.heading) } : {}),
        ...(hasOwn(value, 'links') ? { links: normalizeLinkRows(value.links) } : {}),
      }
    case 'richCard':
      return {
        ...value,
        ...(hasOwn(value, 'title') ? { title: trim(value.title) } : {}),
        ...(hasOwn(value, 'description') ? { description: trim(value.description) } : {}),
        ...(hasOwn(value, 'link') ? { link: normalizeLink(value.link) } : {}),
      }
    default:
      return value
  }
}

const normalizeNavigationItem = (value: unknown): unknown => {
  if (!isRecord(value)) return value

  return {
    ...value,
    ...(hasOwn(value, 'label') ? { label: trim(value.label) } : {}),
    ...(hasOwn(value, 'link') ? { link: normalizeLink(value.link) } : {}),
    ...(hasOwn(value, 'content')
      ? {
          content: Array.isArray(value.content) ? value.content.map(normalizeBlock) : value.content,
        }
      : {}),
  }
}

export const normalizeHeader: GlobalBeforeValidateHook = ({ data }) => {
  if (!isRecord(data)) return data

  return {
    ...data,
    ...(hasOwn(data, 'navItems')
      ? {
          navItems: Array.isArray(data.navItems)
            ? data.navItems.map(normalizeNavigationItem)
            : data.navItems,
        }
      : {}),
    ...(hasOwn(data, 'menuCta') ? { menuCta: normalizeLink(data.menuCta) } : {}),
  }
}
