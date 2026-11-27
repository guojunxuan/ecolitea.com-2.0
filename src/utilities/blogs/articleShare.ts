import { resolveSiteAsset } from '@/components/Logo/resolveSiteAsset'
import type { LogoImage } from '@/components/Logo/types'
import type { Settings } from '@/payload-types'

export type ArticleShareModel = {
  links: { name: string; href: string; icon: LogoImage }[]
  copyLink: boolean
}

/** Normalize populated Settings at the server boundary before rendering links. */
export const adaptArticleShare = (
  settings: Settings | null | undefined,
  articleURL: string,
  title: string,
): ArticleShareModel => {
  const share = settings?.blog?.share
  const links: ArticleShareModel['links'] = []
  for (const platform of share?.platforms ?? []) {
    const icon = resolveSiteAsset(platform.icon)
    const name = platform.name?.trim()
    if (!icon || !name || typeof platform.shareURL !== 'string') continue
    const href = platform.shareURL.replace(/\{url\}|\{title\}/g, (placeholder) =>
      encodeURIComponent(placeholder === '{url}' ? articleURL : title),
    )
    try {
      if (!['http:', 'https:', 'mailto:'].includes(new URL(href).protocol)) continue
    } catch {
      continue
    }
    links.push({ name, href, icon })
  }
  return { links, copyLink: share?.copyLink !== false }
}
