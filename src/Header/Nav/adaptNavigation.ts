import { resolveLinkHref, type CMSLinkType } from '@/components/Link'
import { MEDIA_RENDERABLE_MIME_TYPES } from '@/components/Media/config'
import type { Header, Media } from '@/payload-types'

import type {
  HeaderCardData,
  HeaderCardGroupBlockData,
  HeaderCategoryData,
  HeaderCategoryTabsBlockData,
  HeaderLinkData,
  HeaderLinkGroupBlockData,
  HeaderLinkRowData,
  HeaderNavigationBlockData,
  HeaderNavigationData,
  HeaderNavigationItem,
  HeaderRichCardBlockData,
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

type AdaptLinkOptions = {
  label?: string
  labelMode?: 'fallback' | 'override'
}

const adaptLink = (value: unknown, options: AdaptLinkOptions = {}): HeaderLinkData | null => {
  if (!isRecord(value) || (value.type !== 'custom' && value.type !== 'reference')) return null

  const href = text(resolveLinkHref(value as CMSLinkType))
  const contextLabel = text(options.label)
  const label =
    options.labelMode === 'override' ? contextLabel : (text(value.label) ?? contextLabel)
  if (!href || !label) return null

  return {
    href,
    label,
    newTab: value.newTab === true,
    type: value.type,
  }
}

const isOptionalText = (value: unknown): boolean => value == null || typeof value === 'string'

const isOptionalDimension = (value: unknown): boolean =>
  value == null || (typeof value === 'number' && Number.isFinite(value) && value > 0)

const isRenderableImageMedia = (value: unknown): value is Media => {
  if (!isRecord(value)) return false

  const mimeType = text(value.mimeType)
  return Boolean(
    text(value.id) &&
      text(value.createdAt) &&
      text(value.updatedAt) &&
      text(value.url) &&
      mimeType &&
      MEDIA_RENDERABLE_MIME_TYPES.image.some((supported) => supported === mimeType) &&
      isOptionalText(value.alt) &&
      isOptionalDimension(value.width) &&
      isOptionalDimension(value.height),
  )
}

const adaptMedia = (value: unknown): Media | null =>
  isRenderableImageMedia(value) ? value : null

const adaptCard = (value: unknown, fallbackID: string): HeaderCardData | null => {
  if (!isRecord(value)) return null

  const title = text(value.title)
  const link = adaptLink(value.link, { label: title ?? undefined, labelMode: 'override' })
  if (!title || !link) return null

  return {
    id: id(value.id, fallbackID),
    image: adaptMedia(value.image),
    link,
    title,
  }
}

const adaptCards = (value: unknown, key: string): HeaderCardData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    const card = adaptCard(item, `${key}-card-${index}`)
    return card ? [card] : []
  })
}

const adaptLinkRows = (value: unknown, key: string): HeaderLinkRowData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((row, index) => {
    if (!isRecord(row)) return []
    const link = adaptLink(row.link)
    return link ? [{ id: id(row.id, `${key}-link-${index}`), link }] : []
  })
}

const adaptCategory = (value: unknown, fallbackID: string): HeaderCategoryData | null => {
  if (!isRecord(value)) return null

  const categoryID = id(value.id, fallbackID)
  const label = text(value.label)
  const cards = adaptCards(value.items, categoryID)
  if (!label || cards.length === 0) return null

  return {
    cards,
    cta: value.enableCta === true ? adaptLink(value.cta) : null,
    id: categoryID,
    label,
  }
}

const adaptCategoryTabs = (
  value: UnknownRecord,
  blockID: string,
): HeaderCategoryTabsBlockData | null => {
  if (!Array.isArray(value.categories)) return null

  const categories = value.categories.flatMap((category, index) => {
    const adapted = adaptCategory(category, `${blockID}-category-${index}`)
    return adapted ? [adapted] : []
  })
  if (categories.length === 0) return null

  return {
    categories,
    cta: value.enableCta === true ? adaptLink(value.cta) : null,
    id: blockID,
    type: 'categoryTabs',
  }
}

const adaptCardGroup = (
  value: UnknownRecord,
  blockID: string,
): HeaderCardGroupBlockData | null => {
  const cards = adaptCards(value.items, blockID)
  if (cards.length === 0) return null

  return {
    cards,
    cta: value.enableCta === true ? adaptLink(value.cta) : null,
    heading: value.enableHeading === true ? text(value.heading) : null,
    id: blockID,
    type: 'cardGroup',
  }
}

const adaptLinkGroup = (
  value: UnknownRecord,
  blockID: string,
): HeaderLinkGroupBlockData | null => {
  const links = adaptLinkRows(value.links, blockID)
  if (links.length === 0) return null

  return {
    heading: value.enableHeading === true ? text(value.heading) : null,
    id: blockID,
    links,
    type: 'linkGroup',
  }
}

const adaptRichCard = (
  value: UnknownRecord,
  blockID: string,
): HeaderRichCardBlockData | null => {
  const card = adaptCard(value, blockID)
  if (!card) return null

  return {
    card,
    description: text(value.description),
    id: blockID,
    type: 'richCard',
  }
}

const adaptBlock = (
  value: unknown,
  key: string,
  index: number,
): HeaderNavigationBlockData | null => {
  if (!isRecord(value)) return null
  const blockID = id(value.id, `${key}-block-${index}`)

  switch (value.blockType) {
    case 'categoryTabs':
      return adaptCategoryTabs(value, blockID)
    case 'cardGroup':
      return adaptCardGroup(value, blockID)
    case 'linkGroup':
      return adaptLinkGroup(value, blockID)
    case 'richCard':
      return adaptRichCard(value, blockID)
    default:
      return null
  }
}

const adaptContent = (value: unknown, key: string): HeaderNavigationBlockData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((block, index) => {
    const adapted = adaptBlock(block, key, index)
    return adapted ? [adapted] : []
  })
}

const adaptNavigationItem = (value: unknown, index: number): HeaderNavigationItem | null => {
  if (!isRecord(value)) return null
  const label = text(value.label)
  const itemID = id(value.id, `nav-item-${index}`)
  if (!label) return null

  if (value.navigationType === 'directLink') {
    const link = adaptLink(value.link, { label, labelMode: 'override' })
    return link
      ? { content: null, id: itemID, label, link, navigationType: 'directLink' }
      : null
  }

  if (value.navigationType === 'dropdown') {
    const content = adaptContent(value.content, itemID)
    return content.length > 0
      ? { content, id: itemID, label, link: null, navigationType: 'dropdown' }
      : null
  }

  if (value.navigationType === 'directLinkAndDropdown') {
    const link = adaptLink(value.link, { label, labelMode: 'override' })
    const content = adaptContent(value.content, itemID)

    if (link && content.length > 0) {
      return { content, id: itemID, label, link, navigationType: 'directLinkAndDropdown' }
    }
    if (link) return { content: null, id: itemID, label, link, navigationType: 'directLink' }
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
