import type { SiteSettings } from '@/payload-types'
import type { PayloadRequest } from 'payload'

export type SiteIdentity = {
  siteName?: string
  siteDescription?: string
}

type SiteIdentityFields = Partial<Pick<SiteSettings, 'siteName' | 'siteDescription'>>

export function normalizeSiteIdentity(settings?: SiteIdentityFields | null): SiteIdentity {
  const siteName = settings?.siteName?.trim()
  const siteDescription = settings?.siteDescription?.trim()
  return {
    ...(siteName && { siteName }),
    ...(siteDescription && { siteDescription }),
  }
}

export function formatTitle(title?: string | null, siteName?: string | null): string {
  return [title?.trim(), siteName?.trim()].filter(Boolean).join(' | ')
}

export async function getSiteIdentity({ locale = 'en', req }: {
  locale?: string
  req?: PayloadRequest
} = {}): Promise<SiteIdentity> {
  if (req) {
    const settings = await req.payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: false,
      req,
      select: { siteName: true, siteDescription: true },
    })
    return normalizeSiteIdentity(settings)
  }

  // The SEO plugin imports this module while Payload config is being built.
  const { getCachedGlobal } = await import('./getGlobals')
  return normalizeSiteIdentity(await getCachedGlobal('site-settings', 0, locale)())
}
