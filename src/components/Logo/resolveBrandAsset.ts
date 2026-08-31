import type { BrandAsset } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

import type { LogoImage } from './types'

const DEFAULT_WIDTH = 1302
const DEFAULT_HEIGHT = 296

const positiveDimension = (value: number | null | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

export const resolveBrandAsset = (
  asset: string | BrandAsset | null | undefined,
): LogoImage | null => {
  if (!asset || typeof asset !== 'object' || !asset.url) return null

  return {
    src: getMediaUrl(asset.url, asset.updatedAt),
    alt: asset.alt,
    width: positiveDimension(asset.width, DEFAULT_WIDTH),
    height: positiveDimension(asset.height, DEFAULT_HEIGHT),
  }
}
