import { MEDIA_PRESENTATION_DEFAULTS } from './config'
import type { ImagePresentation, MediaFit, VideoPresentation } from './types'

type ImageURLArgs = {
  source: string
  width: number
  quality?: number
  presentation?: ImagePresentation
}

type VideoURLArgs = {
  source: string
  presentation?: VideoPresentation
}

const CLOUDFLARE_VIDEO_DIMENSION = {
  minimum: 10,
  maximum: 2000,
} as const

const CLOUDFLARE_VIDEO_MODE = 'video'

const IMAGE_QUALITY = {
  minimum: 1,
  maximum: 100,
} as const

const MEDIA_FITS = new Set<MediaFit>(['cover', 'contain', 'scale-down'])

const parseTransformSource = (source: string): URL | undefined => {
  let sourceURL: URL

  try {
    sourceURL = new URL(source)
  } catch {
    return undefined
  }

  if (
    (sourceURL.protocol !== 'http:' && sourceURL.protocol !== 'https:') ||
    sourceURL.pathname.startsWith('/cdn-cgi/')
  ) {
    return undefined
  }

  return sourceURL
}

const isFinitePositive = (value: number): boolean => Number.isFinite(value) && value > 0

const normalizeInteger = (value: number): number => Math.round(value)

const normalizeFit = (fit: MediaFit | undefined): MediaFit | undefined =>
  fit && MEDIA_FITS.has(fit) ? fit : undefined

const clampInteger = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, normalizeInteger(value)))

const encodePathname = (pathname: string): string | undefined => {
  try {
    return pathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/')
  } catch {
    return undefined
  }
}

export const buildCloudflareImageURL = ({
  source,
  width,
  quality,
  presentation,
}: ImageURLArgs): string => {
  const sourceURL = parseTransformSource(source)
  const encodedPathname = sourceURL && encodePathname(sourceURL.pathname)

  if (!sourceURL || !encodedPathname || !isFinitePositive(width)) return source

  const normalizedWidth = normalizeInteger(width)
  if (normalizedWidth < 1) return source

  const ratio = presentation?.aspectRatio
  if (
    ratio &&
    (!isFinitePositive(ratio.width) ||
      !isFinitePositive(ratio.height) ||
      normalizeInteger((normalizedWidth * ratio.height) / ratio.width) < 1)
  ) {
    return source
  }

  const fit = normalizeFit(presentation?.fit ?? MEDIA_PRESENTATION_DEFAULTS.image.fit)
  if (!fit) return source

  const requestedQuality =
    quality ?? presentation?.quality ?? MEDIA_PRESENTATION_DEFAULTS.image.quality
  if (!Number.isFinite(requestedQuality)) return source

  const options = [`width=${normalizedWidth}`]
  if (ratio) {
    options.push(`height=${normalizeInteger((normalizedWidth * ratio.height) / ratio.width)}`)
  }
  options.push(
    `fit=${fit}`,
    `quality=${clampInteger(requestedQuality, IMAGE_QUALITY.minimum, IMAGE_QUALITY.maximum)}`,
    'format=auto',
  )

  return `${sourceURL.origin}/cdn-cgi/image/${options.join(',')}${encodedPathname}${sourceURL.search}`
}

export const buildCloudflareVideoURL = ({ source, presentation }: VideoURLArgs): string => {
  const sourceURL = parseTransformSource(source)
  if (!sourceURL) return source

  const { width, height } = presentation ?? {}
  if (
    (width !== undefined && !isFinitePositive(width)) ||
    (height !== undefined && !isFinitePositive(height))
  ) {
    return source
  }

  const fit = normalizeFit(presentation?.fit)
  if (presentation?.fit !== undefined && !fit) return source

  const options = [`mode=${CLOUDFLARE_VIDEO_MODE}`]
  if (width !== undefined) {
    options.push(
      `width=${clampInteger(
        width,
        CLOUDFLARE_VIDEO_DIMENSION.minimum,
        CLOUDFLARE_VIDEO_DIMENSION.maximum,
      )}`,
    )
  }
  if (height !== undefined) {
    options.push(
      `height=${clampInteger(
        height,
        CLOUDFLARE_VIDEO_DIMENSION.minimum,
        CLOUDFLARE_VIDEO_DIMENSION.maximum,
      )}`,
    )
  }
  if (fit) options.push(`fit=${fit}`)

  return `${sourceURL.origin}/cdn-cgi/media/${options.join(',')}/${encodeURIComponent(sourceURL.href)}`
}
