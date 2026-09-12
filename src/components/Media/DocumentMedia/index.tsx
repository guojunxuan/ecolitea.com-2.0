import React from 'react'

import { getMediaUrl } from '@/utilities/getMediaUrl'

import type { Props as MediaProps } from '../types'

export const DocumentMedia: React.FC<MediaProps> = ({ alt, resource }) => {
  if (
    !resource ||
    typeof resource !== 'object' ||
    typeof resource.url !== 'string' ||
    resource.url.trim().length === 0
  )
    return null

  return (
    <a href={getMediaUrl(resource.url, resource.updatedAt)}>
      {alt || resource.alt || resource.filename || 'Download document'}
    </a>
  )
}
