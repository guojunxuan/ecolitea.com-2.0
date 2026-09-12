import type { MediaPresentation } from './types'

const DEFAULT_IMAGE_QUALITY = 85

export const MEDIA_PRESENTATION_DEFAULTS = {
  image: {
    fit: 'scale-down',
    quality: DEFAULT_IMAGE_QUALITY,
  },
} as const satisfies MediaPresentation

export const MEDIA_RENDERABLE_MIME_TYPES = {
  document: [
    'application/msword',
    'application/pdf',
    'application/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
  ],
  image: ['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4'],
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
  },
} as const satisfies Record<string, MediaPresentation>
