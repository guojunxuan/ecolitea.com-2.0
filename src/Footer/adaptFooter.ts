import { resolveLinkHref, type CMSLinkType } from '@/components/Link'
import { resolveBrandAsset } from '@/components/Logo/resolveBrandAsset'
import { selectLogo } from '@/components/Logo/selectLogo'
import type { Footer, SiteSettings } from '@/payload-types'

import type {
  FooterColumnData,
  FooterData,
  FooterLinkData,
  FooterLinkRowData,
  SocialLinkData,
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

const adaptLink = (value: unknown, labelOverride?: string): FooterLinkData | null => {
  if (!isRecord(value) || (value.type !== 'custom' && value.type !== 'reference')) return null

  const href = text(resolveLinkHref(value as CMSLinkType))
  const label = text(labelOverride) ?? text(value.label)
  if (!href || !label) return null

  return {
    href,
    label,
    newTab: value.newTab === true,
    type: value.type,
  }
}

const adaptNavItems = (value: unknown, columnID: string): FooterLinkRowData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((row, index) => {
    if (!isRecord(row)) return []
    const link = adaptLink(row.link)
    return link ? [{ id: id(row.id, `${columnID}-link-${index}`), link }] : []
  })
}

const adaptColumns = (value: unknown): FooterColumnData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((column, index) => {
    if (!isRecord(column)) return []
    const label = text(column.label)
    if (!label) return []
    const columnID = id(column.id, `footer-column-${index}`)

    return [{ id: columnID, label, navItems: adaptNavItems(column.navItems, columnID) }]
  })
}

const adaptSocialLinks = (value: unknown): SocialLinkData[] => {
  if (!Array.isArray(value)) return []

  return value.flatMap((row, index) => {
    if (!isRecord(row) || !isRecord(row.platform)) return []
    const platform = text(row.platform.platform)
    const url = text(row.url)
    if (!platform || !url) return []

    return [
      {
        icon: resolveBrandAsset(row.platform.icon as never),
        id: id(row.id, `social-link-${index}`),
        platform,
        url,
      },
    ]
  })
}

const adaptLegalLink = (value: unknown, label: string): FooterLinkData | null =>
  adaptLink(
    {
      type: 'reference',
      reference: { relationTo: 'pages', value },
    },
    label,
  )

export const adaptFooter = (footer: Footer, siteSettings: SiteSettings): FooterData => {
  const siteName = text(siteSettings.siteName) ?? text(siteSettings.legalCompanyName) ?? 'Ecolitea'
  const legalLinks = [
    adaptLegalLink(siteSettings.privacyPolicyPage, 'Privacy Policy'),
    adaptLegalLink(siteSettings.termsPage, 'Terms'),
  ].filter((link): link is FooterLinkData => link !== null)

  return {
    siteName,
    logo: selectLogo(
      resolveBrandAsset(siteSettings.logo),
      resolveBrandAsset(siteSettings.logoDark),
      true,
    ),
    siteDescription: text(siteSettings.siteDescription),
    socialLinks: adaptSocialLinks(siteSettings.socialLinks),
    columns: adaptColumns(footer.columns),
    contact: {
      address: text(siteSettings.address),
      businessHours: text(siteSettings.businessHours),
      phone: text(siteSettings.phone),
      salesEmail: text(siteSettings.salesEmail),
      whatsapp: text(siteSettings.whatsapp),
    },
    legalLinks,
    copyrightText: text(siteSettings.copyrightText) ?? `© ${siteName}`,
  }
}
