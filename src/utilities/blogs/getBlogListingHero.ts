import type { Media, Settings } from '@/payload-types'

import { getCachedSettings } from '@/utilities/getGlobals'

export type BlogListingHeroModel = {
  heading: string
  description?: string | null
  image?: Media | string | null
  mobileMedia?: Media | null
  headerTheme: 'light' | 'dark'
}

export const getBlogListingHero = async (): Promise<BlogListingHeroModel | null> => {
  const settings: Settings | null = await getCachedSettings()
  const hero = settings?.blog?.hero

  if (hero?.enabled !== true) return null

  const heading = hero.heading?.trim() ?? ''
  if (!heading) return null

  const description = hero.description?.trim() ?? ''
  const headerTheme = hero.headerTheme === 'dark' ? 'dark' : 'light'
  const mobileMedia = hero.mobileMedia

  return {
    heading,
    description: description || null,
    image: hero.image,
    mobileMedia:
      mobileMedia &&
      typeof mobileMedia === 'object' &&
      mobileMedia.url &&
      mobileMedia.mimeType?.startsWith('image/')
        ? mobileMedia
        : null,
    headerTheme,
  }
}
