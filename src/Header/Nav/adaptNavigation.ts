import { resolveLinkHref, type CMSLinkType } from '@/components/Link'
import type { Header } from '@/payload-types'

import type {
  HeaderDropdownData,
  HeaderDropdownItemData,
  HeaderFeaturedItemData,
  HeaderLinkData,
  HeaderLinkRowData,
  HeaderNavigationData,
  HeaderNavigationItem,
} from './types'

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

const id = (value: unknown, fallback: string): string => text(value) ?? fallback

const adaptLink = (value: unknown, fallbackLabel?: string): HeaderLinkData | null => {
  if (!isRecord(value) || (value.type !== 'custom' && value.type !== 'reference')) return null

  const href = text(resolveLinkHref(value as CMSLinkType))
  const label = text(value.label) ?? text(fallbackLabel)
  if (!href || !label) return null

  return {
    href,
    label,
    newTab: value.newTab === true,
    type: value.type,
  }
}

const adaptLinkRows = (value: unknown, key: string): HeaderLinkRowData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((row, index) => {
    if (!isRecord(row)) return []
    const link = adaptLink(row.link)
    return link ? [{ id: id(row.id, `${key}-link-${index}`), link }] : []
  })
}

const adaptDropdownItem = (
  value: unknown,
  key: string,
  index: number,
): HeaderDropdownItemData | null => {
  if (!isRecord(value)) return null
  const rowID = id(value.id, `${key}-item-${index}`)

  if (value.type === 'default' && isRecord(value.defaultItem)) {
    const link = adaptLink(value.defaultItem.link)
    if (!link) return null
    return {
      id: rowID,
      type: 'default',
      defaultItem: { description: text(value.defaultItem.description), link },
    }
  }

  if (value.type === 'featured' && isRecord(value.featuredItem)) {
    const tag = text(value.featuredItem.tag)
    const landingLink = adaptLink(value.featuredItem.landingLink, 'View all')
    if (!tag || !landingLink) return null
    return {
      id: rowID,
      type: 'featured',
      featuredItem: {
        tag,
        landingLink,
        label: (value.featuredItem.label ?? null) as HeaderFeaturedItemData['label'],
        links: adaptLinkRows(value.featuredItem.links, rowID),
      },
    }
  }

  if (value.type === 'list' && isRecord(value.listItem)) {
    const tag = text(value.listItem.tag)
    const landingLink = adaptLink(value.listItem.landingLink, 'View all')
    if (!tag || !landingLink) return null
    return {
      id: rowID,
      type: 'list',
      listItem: {
        tag,
        landingLink,
        links: adaptLinkRows(value.listItem.links, rowID),
      },
    }
  }

  return null
}

const adaptDropdown = (value: unknown, key: string): HeaderDropdownData | null => {
  if (!isRecord(value) || !Array.isArray(value.items)) return null

  const items = value.items.flatMap((item, index) => {
    const adapted = adaptDropdownItem(item, key, index)
    return adapted ? [adapted] : []
  })
  if (items.length === 0) return null

  return {
    description: text(value.description),
    descriptionLinks: adaptLinkRows(value.descriptionLinks, `${key}-description`),
    items,
  }
}

const adaptNavigationItem = (value: unknown, index: number): HeaderNavigationItem | null => {
  if (!isRecord(value)) return null
  const label = text(value.label)
  const itemID = id(value.id, `nav-item-${index}`)
  if (!label) return null

  if (value.navigationType === 'directLink') {
    const link = adaptLink(value.link, label)
    return link ? { id: itemID, label, navigationType: 'directLink', link, dropdown: null } : null
  }

  if (value.navigationType === 'dropdown') {
    const dropdown = adaptDropdown(value.dropdown, itemID)
    return dropdown ? { id: itemID, label, navigationType: 'dropdown', link: null, dropdown } : null
  }

  if (value.navigationType === 'directLinkAndDropdown') {
    const link = adaptLink(value.link, label)
    const dropdown = adaptDropdown(value.dropdown, itemID)
    return link && dropdown
      ? { id: itemID, label, navigationType: 'directLinkAndDropdown', link, dropdown }
      : null
  }

  return null
}

export const adaptHeaderNavigation = (header: Header): HeaderNavigationData => ({
  navItems: Array.isArray(header.navItems)
    ? header.navItems.flatMap((item, index) => {
        const adapted = adaptNavigationItem(item, index)
        return adapted ? [adapted] : []
      })
    : [],
  menuCta: header.enableMenuCta === true ? adaptLink(header.menuCta) : null,
})
