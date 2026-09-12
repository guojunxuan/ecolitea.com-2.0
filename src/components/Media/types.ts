import type { StaticImageData } from 'next/image'
import type { ElementType, Ref } from 'react'

import type { Media as MediaType } from '@/payload-types'

export type AspectRatio = {
  width: number
  height: number
}

export type MediaFit = 'cover' | 'contain' | 'scale-down'

export type ImagePresentation = {
  aspectRatio?: AspectRatio
  fit?: MediaFit
  quality?: number
}

export type VideoPresentation = {
  width?: number
  height?: number
  fit?: MediaFit
}

export type MediaPresentation = {
  image?: ImagePresentation
  video?: VideoPresentation
}

export interface Props {
  alt?: string
  className?: string
  fill?: boolean // for NextImage only
  htmlElement?: ElementType | null
  pictureClassName?: string
  imgClassName?: string
  onClick?: () => void
  onLoad?: () => void
  loading?: 'lazy' | 'eager' // for NextImage only
  priority?: boolean // for NextImage only
  presentation?: MediaPresentation
  ref?: Ref<HTMLImageElement | HTMLVideoElement | null>
  resource?: MediaType | string | number | null // for Payload media
  size?: string // for NextImage only
  src?: StaticImageData // for static media
  videoClassName?: string
}
