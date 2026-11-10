import type { Media, Settings } from '@/payload-types'
import { MEDIA_RENDERABLE_MIME_TYPES } from '@/collections/mediaUploadPolicy.shared'
import { getCachedSettings } from '@/utilities/getGlobals'
import { productCategoryPath } from './paths'

export type CategoryCarouselItem = {
  id: string
  title: string
  href: string
  image: Media | null
  imageFit: 'contain' | 'cover'
}
type CategorySource = { id: string; title: string; slug: string; image: Media | null }

export const getProductCategoryCarousel = async (
  categories: CategorySource[],
): Promise<CategoryCarouselItem[]> => {
  const settings: Settings | null = await getCachedSettings()
  const config = settings?.product?.categoryCarousel
  if (config?.enabled === false) return []
  const byID = new Map(categories.map((category) => [category.id, category]))
  const seen = new Set<string>()
  const items = config?.items?.length
    ? config.items
    : categories.map(({ id }) => ({ category: id }))
  return items.flatMap((item) => {
    const id = typeof item.category === 'string' ? item.category : item.category?.id
    const category = id ? byID.get(id) : null
    if (!category || seen.has(category.id)) return []
    seen.add(category.id)
    const candidate = 'image' in item ? item.image : null
    const override =
      candidate &&
      typeof candidate === 'object' &&
      candidate.url &&
      MEDIA_RENDERABLE_MIME_TYPES.image.some((mime) => mime === candidate.mimeType)
        ? candidate
        : null
    return [
      {
        id: category.id,
        title: category.title,
        href: productCategoryPath(category.slug),
        image: override ?? category.image,
        imageFit:
          override && 'imageFit' in item && item.imageFit === 'contain'
            ? ('contain' as const)
            : ('cover' as const),
      },
    ]
  })
}
