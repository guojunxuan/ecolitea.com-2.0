import type { Settings } from '@/payload-types'
import type { BlogListingHeroModel } from '@/utilities/blogs/getBlogListingHero'

import { getCachedSettings } from '@/utilities/getGlobals'

export const getProductListingHero = async (): Promise<BlogListingHeroModel | null> => {
  const settings: Settings | null = await getCachedSettings()
  const hero = settings?.product?.hero

  if (hero?.enabled !== true) return null

  const heading = hero.heading?.trim() ?? ''
  if (!heading) return null

  const description = hero.description?.trim() ?? ''
  const headerTheme = hero.headerTheme === 'dark' ? 'dark' : 'light'

  return {
    heading,
    description: description || null,
    image: hero.image,
    headerTheme,
  }
}
