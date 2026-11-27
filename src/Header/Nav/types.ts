import type { Media } from '@/payload-types'

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

export type HeaderCardData = {
  id: string
  image: Media | null
  link: HeaderLinkData
  title: string
}

export type HeaderCategoryData = {
  cards: HeaderCardData[]
  cta: HeaderLinkData | null
  id: string
  label: string
}

export type HeaderCategoryTabsBlockData = {
  categories: HeaderCategoryData[]
  cta: HeaderLinkData | null
  id: string
  type: 'categoryTabs'
}

export type HeaderCardGroupBlockData = {
  cards: HeaderCardData[]
  cta: HeaderLinkData | null
  heading: string | null
  id: string
  type: 'cardGroup'
}

export type HeaderLinkGroupBlockData = {
  heading: string | null
  id: string
  links: HeaderLinkRowData[]
  type: 'linkGroup'
}

export type HeaderRichCardBlockData = {
  card: HeaderCardData
  description: string | null
  id: string
  type: 'richCard'
}

export type HeaderNavigationBlockData =
  | HeaderCategoryTabsBlockData
  | HeaderCardGroupBlockData
  | HeaderLinkGroupBlockData
  | HeaderRichCardBlockData

export type HeaderNavigationItem =
  | {
      content: null
      id: string
      label: string
      link: HeaderLinkData
      navigationType: 'directLink'
    }
  | {
      content: HeaderNavigationBlockData[]
      id: string
      label: string
      link: null
      navigationType: 'dropdown'
    }
  | {
      content: HeaderNavigationBlockData[]
      id: string
      label: string
      link: HeaderLinkData
      navigationType: 'directLinkAndDropdown'
    }

export type HeaderNavigationData = {
  menuCta: HeaderLinkData | null
  navItems: HeaderNavigationItem[]
}
