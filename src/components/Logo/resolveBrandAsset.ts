import type { BrandAsset } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'

import type { LogoImage } from './types'

const DEFAULT_WIDTH = 1302
const DEFAULT_HEIGHT = 296

const isPositiveDimension = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const resolveDimensions = (width: number | null | undefined, height: number | null | undefined) => {
  if (isPositiveDimension(width) && isPositiveDimension(height)) return { width, height }

  if (isPositiveDimension(width)) {
    return { width, height: Math.round((width * DEFAULT_HEIGHT) / DEFAULT_WIDTH) }
  }

  if (isPositiveDimension(height)) {
    return { width: Math.round((height * DEFAULT_WIDTH) / DEFAULT_HEIGHT), height }
  }

  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
}

export const resolveBrandAsset = (
  asset: string | BrandAsset | null | undefined,
): LogoImage | null => {
  if (!asset || typeof asset !== 'object' || !asset.url) return null

  const { width, height } = resolveDimensions(asset.width, asset.height)
  const source = asset.filename
    ? `/api/brand-assets/file/${encodeURIComponent(asset.filename)}`
    : asset.url

  return {
    src: getMediaUrl(source, asset.updatedAt),
    alt: asset.alt,
    width,
    height,
  }
}
