'use client'

import { useConfig, usePayloadAPI, useRowLabel } from '@payloadcms/ui'
import type { RowLabelProps } from '@payloadcms/ui'
import React from 'react'

type SocialLinkRow = {
  platform?: null | number | string | { platform?: string }
}

export const getSocialLinkRowLabel = (platform: SocialLinkRow['platform']): string => {
  if (platform == null || platform === '') return 'Unselected platform'
  if (typeof platform === 'object') return platform.platform || 'Unavailable platform'
  return 'Unavailable platform'
}

const RelatedPlatformLabel = ({ id }: { id: number | string }) => {
  const {
    config: { routes: { api }, serverURL },
  } = useConfig()
  const [{ data, isError, isLoading }] = usePayloadAPI(
    `${serverURL || ''}${api}/social-platforms/${encodeURIComponent(String(id))}?depth=0`,
  )

  if (isLoading) return <span>Social Link</span>
  if (isError || !data?.platform) return <span>Unavailable platform</span>
  return <span>{data.platform}</span>
}

export const SocialLinkRowLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<SocialLinkRow>()
  const platform = data?.platform

  if (platform == null || platform === '' || typeof platform === 'object') {
    return <span>{getSocialLinkRowLabel(platform)}</span>
  }

  return <RelatedPlatformLabel id={platform} />
}
