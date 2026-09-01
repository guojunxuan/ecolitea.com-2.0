import type { BrandAsset } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

export type FaviconPresentation = {
  url: string
  type?: string
}

export const resolveFavicon = (
  asset: string | BrandAsset | null | undefined,
): FaviconPresentation | null => {
  if (!asset || typeof asset !== 'object' || !asset.url) return null

  return {
    url: getMediaUrl(asset.url, asset.updatedAt),
    type: asset.mimeType || undefined,
  }
}
