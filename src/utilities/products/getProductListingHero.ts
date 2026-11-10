import type { Media, Settings } from '@/payload-types'
import { MEDIA_RENDERABLE_MIME_TYPES } from '@/collections/mediaUploadPolicy.shared'
import { getCachedSettings } from '@/utilities/getGlobals'
import { resolveLinkHref, type CMSLinkDestination } from '@/utilities/resolveLinkHref'

export type ProductHeroSlide = {
  id: string
  showText: boolean
  media: Media | null
  mobileMedia: Media | null
  title: string
  description: string | null
  theme: 'dark' | 'light'
  cta: CMSLinkDestination | null
}

type RawSlide = NonNullable<NonNullable<Settings['product']>['heroSlides']>[number]

const populatedMedia = (value: Media | string | null | undefined): Media | null =>
  value &&
  typeof value === 'object' &&
  value.url &&
  [...MEDIA_RENDERABLE_MIME_TYPES.image, ...MEDIA_RENDERABLE_MIME_TYPES.video].some(
    (type) => type === value.mimeType,
  )
    ? value
    : null

const toSlide = (slide: RawSlide, index: number): ProductHeroSlide[] => {
  const title = slide.title?.trim() ?? ''
  const media = populatedMedia(slide.media)
  const showText = slide.showText === true
  if (!title || (!media && !showText)) return []
  const candidate: CMSLinkDestination | null =
    slide.enableCta && slide.cta?.label?.trim()
      ? { ...slide.cta, label: slide.cta.label.trim() }
      : null
  return [
    {
      id: slide.id ?? String(index),
      showText,
      media,
      mobileMedia: populatedMedia(slide.mobileMedia),
      title,
      description: slide.description?.trim() || null,
      theme: slide.theme === 'light' ? 'light' : 'dark',
      cta: candidate && resolveLinkHref(candidate) ? candidate : null,
    },
  ]
}

export const getProductListingHero = async (): Promise<ProductHeroSlide[]> => {
  const settings: Settings | null = await getCachedSettings()
  return (settings?.product?.heroSlides ?? []).flatMap(toSlide)
}
