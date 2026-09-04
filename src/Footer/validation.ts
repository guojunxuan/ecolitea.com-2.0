import type { FieldHook } from 'payload'

type FooterColumn = { label?: unknown }
type RelationshipValue = {
  relationTo?: unknown
  value?: unknown
}
type NavigationLinkRow = {
  link?: {
    reference?: RelationshipValue | null
    type?: unknown
    url?: unknown
  } | null
}

export const trimText: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim() : value)

export const validateNonBlankText = (value?: unknown): string | true =>
  typeof value === 'string' && value.trim().length > 0
    ? true
    : 'Enter a value that is not only whitespace.'

export const validateFooterURL = (value?: unknown): string | true => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Enter a custom URL.'
  }

  const url = value.trim()
  const isSupported =
    /^https?:\/\/[^\s]+$/i.test(url) ||
    /^\/(?!\/)[^\s]*$/.test(url) ||
    /^#[^\s]+$/.test(url) ||
    /^mailto:[^\s@]+@[^\s@]+$/i.test(url) ||
    /^tel:\+?[0-9().\-\s]+$/i.test(url)

  return isSupported ? true : 'Use http(s), a root-relative path, an anchor, mailto, or tel URL.'
}

export const validateFooterColumnLabels = (value?: unknown): string | true => {
  if (!Array.isArray(value)) return true

  const labels = value
    .map((column) => (column as FooterColumn)?.label)
    .filter((label): label is string => typeof label === 'string')
    .map((label) => label.trim())
    .filter(Boolean)

  return new Set(labels).size === labels.length ? true : 'Navigation Column labels must be unique.'
}

const getRelationshipID = (value: unknown): string | number | undefined => {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : undefined
  }
  return undefined
}

const getDestinationKey = (row: NavigationLinkRow): string | undefined => {
  const link = row?.link
  if (!link) return undefined

  if (link.type === 'custom') {
    return typeof link.url === 'string' && link.url.trim() ? `custom:${link.url.trim()}` : undefined
  }

  const reference = link.reference
  const id = getRelationshipID(reference?.value)
  return typeof reference?.relationTo === 'string' && id !== undefined
    ? `reference:${reference.relationTo}:${String(id)}`
    : undefined
}

export const validateFooterNavigationLinks = (value?: unknown): string | true => {
  if (!Array.isArray(value)) return true

  const destinations = value
    .map((row) => getDestinationKey(row as NavigationLinkRow))
    .filter((destination): destination is string => Boolean(destination))

  return new Set(destinations).size === destinations.length
    ? true
    : 'Navigation Links in the same column must use unique destinations.'
}
