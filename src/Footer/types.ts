import type { LogoImage } from '@/components/Logo/types'

export type FooterLinkData = {
  href: string
  label: string
  newTab: boolean
  type: 'custom' | 'reference'
}

export type FooterLinkRowData = {
  id: string
  link: FooterLinkData
}

export type FooterColumnData = {
  id: string
  label: string
  navItems: FooterLinkRowData[]
}

export type ContactData = {
  address: string
  phone: string
  salesEmail: string
}

export type NewsletterData = {
  buttonLabel: string
  description: string
  emailPlaceholder: string
  heading: string
}

export type SocialLinkData = {
  icon: LogoImage
  id: string
  platform: string
  url: string
}

export type FooterData = {
  logo: LogoImage | null
  siteDescription: string | null
  socialLinks: SocialLinkData[]
  columns: FooterColumnData[]
  contact: ContactData
  newsletter: NewsletterData | null
  legalLinks: FooterLinkData[]
  copyrightText: string
}
