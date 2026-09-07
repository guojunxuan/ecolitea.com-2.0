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
  address: string | null
  businessHours: string | null
  phone: string | null
  salesEmail: string | null
  whatsapp: string | null
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
  legalLinks: FooterLinkData[]
  copyrightText: string
}
