import React, { Fragment } from 'react'

import type { Props } from './types'

import { MEDIA_RENDERABLE_MIME_TYPES } from './config'
import { DocumentMedia } from './DocumentMedia'
import { ImageMedia } from './ImageMedia'
import { VideoMedia } from './VideoMedia'

const includesMimeType = (mimeTypes: readonly string[], mimeType: string | null | undefined) =>
  typeof mimeType === 'string' && mimeTypes.includes(mimeType)

export const Media: React.FC<Props> = (props) => {
  const { className, htmlElement = 'div', resource } = props

  const mimeType = typeof resource === 'object' ? resource?.mimeType : undefined
  const hasOriginalURL =
    typeof resource === 'object' &&
    typeof resource?.url === 'string' &&
    resource.url.trim().length > 0
  const renderer = props.src ? (
    <ImageMedia {...props} />
  ) : includesMimeType(MEDIA_RENDERABLE_MIME_TYPES.image, mimeType) ? (
    <ImageMedia {...props} />
  ) : includesMimeType(MEDIA_RENDERABLE_MIME_TYPES.video, mimeType) ? (
    <VideoMedia {...props} />
  ) : hasOriginalURL ? (
    <DocumentMedia {...props} />
  ) : null
  const Tag = htmlElement || Fragment

  return (
    <Tag
      {...(htmlElement !== null
        ? {
            className,
          }
        : {})}
    >
      {renderer}
    </Tag>
  )
}
