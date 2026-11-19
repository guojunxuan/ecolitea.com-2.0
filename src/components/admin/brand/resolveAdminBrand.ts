import type { SiteSetting } from '@/payload-types'
import { resolveSiteAsset } from '@/components/Logo/resolveSiteAsset'
import { resolveFavicon } from '@/components/Logo/resolveFavicon'

export function resolveAdminBrand(settings?: Partial<Pick<SiteSetting, 'siteName' | 'logo' | 'favicon'>> | null) {
  const logo = resolveSiteAsset(settings?.logo)
  const icon = resolveFavicon(settings?.favicon)
  return {
    name: settings?.siteName?.trim() || 'Admin',
    ...(logo && { logo }),
    ...(icon && { icon }),
  }
}
