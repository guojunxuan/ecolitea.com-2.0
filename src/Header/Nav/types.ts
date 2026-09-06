import type { HeaderDropdownItem } from '@/payload-types'

type FeaturedItem = NonNullable<HeaderDropdownItem[number]['featuredItem']>

export type HeaderLinkData = {
  href: string
  label: string
  newTab: boolean
  type: 'custom' | 'reference'
}

export type HeaderLinkRowData = {
  id: string
  link: HeaderLinkData
}

export type HeaderDefaultItemData = {
  description: string | null
  link: HeaderLinkData
}

export type HeaderFeaturedItemData = {
  tag: string
  landingLink: HeaderLinkData
  label: FeaturedItem['label'] | null
  links: HeaderLinkRowData[]
}

export type HeaderListItemData = {
  tag: string
  landingLink: HeaderLinkData
  links: HeaderLinkRowData[]
}

export type HeaderDropdownItemData =
  | { defaultItem: HeaderDefaultItemData; id: string; type: 'default' }
  | { featuredItem: HeaderFeaturedItemData; id: string; type: 'featured' }
  | { id: string; listItem: HeaderListItemData; type: 'list' }

export type HeaderDropdownData = {
  description: string | null
  descriptionLinks: HeaderLinkRowData[]
  items: HeaderDropdownItemData[]
}

export type HeaderNavigationItem = {
  dropdown: HeaderDropdownData | null
  id: string
  label: string
  link: HeaderLinkData | null
  navigationType: 'directLink' | 'dropdown' | 'directLinkAndDropdown'
}

export type HeaderNavigationData = {
  navItems: HeaderNavigationItem[]
  menuCta: HeaderLinkData | null
}
