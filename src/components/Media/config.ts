import type { MediaPresentation } from './types'
import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy.shared'

const DEFAULT_IMAGE_QUALITY = 85

export const MEDIA_PRESENTATION_DEFAULTS = {
  image: {
    fit: 'scale-down',
    quality: DEFAULT_IMAGE_QUALITY,
  },
  video: { playback: 'ambient' },
} as const satisfies MediaPresentation

export const MEDIA_RENDERABLE_MIME_TYPES = {
  image: MEDIA_UPLOAD_POLICY.image.mimeTypes,
  video: MEDIA_UPLOAD_POLICY.video.mimeTypes,
} as const

export const MEDIA_PRESENTATION = {
  card: {
    image: {
      aspectRatio: { width: 4, height: 3 },
      fit: 'cover',
      quality: DEFAULT_IMAGE_QUALITY,
    },
  },
  body: {
    image: {
      fit: 'scale-down',
      quality: DEFAULT_IMAGE_QUALITY,
    },
  },
  hero: {
    image: {
      fit: 'scale-down',
      quality: DEFAULT_IMAGE_QUALITY,
    },
    video: { playback: 'ambient' },
  },
} as const satisfies Record<string, MediaPresentation>
