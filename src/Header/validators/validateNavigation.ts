/**
 * Business-rule validator for the Header `navItems` array.
 *
 * Payload can already express most per-field constraints (required text, the
 * dropdown `items` array's `minRows`, the `tag`'s `required`, the `reference` /
 * `url` `required` flags inside a link group). This validator only adds the
 * cross-field rules Payload can't:
 *
 *   1. `directLink` / `directLinkAndDropdown` rows must have a usable link
 *      destination.
 *   2. `dropdown` / `directLinkAndDropdown` rows must declare at least one
 *      dropdown item.
 *   3. `featured` / `list` dropdown items must carry a non-empty `tag` and a
 *      usable `landingLink` destination.
 *
 * It validates only the "active" group for a given `navigationType` / item
 * `type`. Stale data in a conditionally-hidden group (e.g. a leftover
 * `dropdown` on a `directLink` row) is ignored rather than reported.
 *
 * It is read-only: it never mutates the input.
 */

export type HeaderLinkValue = {
  type?: 'reference' | 'custom' | null
  reference?: { relationTo?: string; value?: unknown } | null
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
  // The direct-link group wraps a `link()` field that is also named `link`,
  // so the destination is NESTED: { link: { link: { type, reference, url } } }.
  link?: { link?: HeaderLinkValue } | null
  dropdown?: {
    description?: string | null
    descriptionLinks?: unknown
    items?: HeaderDropdownItemValue[] | null
  } | null
}

/**
 * A link is usable when it resolves to a destination: either an internal
 * `reference` whose `value` is truthy (an id string or a populated doc), or a
 * `custom` link with a non-empty (trimmed) `url`.
 */
export const hasDestination = (link?: HeaderLinkValue | null): boolean => {
  if (!link) return false
  if (link.type === 'reference') return Boolean(link.reference?.value)
  if (link.type === 'custom') return Boolean(link.url?.trim())
  return false
}

// `ArrayFieldValidation` is `(value: null | unknown[] | undefined, options) => …`.
// Under `strictFunctionTypes` a parameter typed only as `HeaderNavItemValue[]`
// can't accept Payload's `unknown[]`, so the public boundary takes the broad
// value and we narrow to the row type below. Runtime behavior is unchanged.
export const validateHeaderNavItems = (
  items?: unknown[] | null,
): string | true => {
  if (!items) return true

  const rows = Array.isArray(items) ? (items as HeaderNavItemValue[]) : null
  if (!rows) return 'navItems must be an array.'

  for (const item of rows) {
    const label = item?.label || '(untitled item)'
    const navigationType = item?.navigationType

    // Rule 1 — direct link / hybrid rows must point somewhere.
    // The direct-link group wraps a `link()` field that is also named `link`,
    // so the destination is nested at `item.link.link`.
    if (navigationType === 'directLink' || navigationType === 'directLinkAndDropdown') {
      if (!hasDestination(item?.link?.link)) {
        return `"${label}" (${navigationType}): A "Direct Link" destination is required — pick a referenced document or enter a non-empty custom URL.`
      }
    }

    // Rule 2 — dropdown / hybrid rows must have at least one item.
    if (navigationType === 'dropdown' || navigationType === 'directLinkAndDropdown') {
      const dropdown = item?.dropdown
      const entries = dropdown?.items

      if (!Array.isArray(entries) || entries.length === 0) {
        return `"${label}" (${navigationType}): At least one dropdown item is required.`
      }

      // Rule 3 — resolve the active group per item type.
      for (const entry of entries) {
        const entryType = entry?.type

        if (entryType === 'featured') {
          const featured = entry?.featuredItem
          const tag = featured?.tag

          if (!tag || tag.trim() === '') {
            return `"${label}" dropdown item (type: featured): A tag is required.`
          }

          if (!hasDestination(featured?.landingLink)) {
            return `"${label}" dropdown item (type: featured, tag: "${tag}"): A "Landing Link" destination is required — pick a referenced document or enter a non-empty custom URL.`
          }
        } else if (entryType === 'list') {
          const list = entry?.listItem
          const tag = list?.tag

          if (!tag || tag.trim() === '') {
            return `"${label}" dropdown item (type: list): A tag is required.`
          }

          if (!hasDestination(list?.landingLink)) {
            return `"${label}" dropdown item (type: list, tag: "${tag}"): A "Landing Link" destination is required — pick a referenced document or enter a non-empty custom URL.`
          }
        }
        // `default` items (and any unrecognized `type`) carry no extra
        // business rule here — Payload handles their own link validation.
      }
    }
  }

  return true
}
