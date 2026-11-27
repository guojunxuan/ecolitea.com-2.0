import type { GlobalAfterChangeHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

export const revalidateSiteSettings: GlobalAfterChangeHook = ({
  doc,
  req: { payload, context },
}) => {
  if (!context.disableRevalidate) {
    payload.logger.info('Revalidating site settings')
    revalidateTag('global_site-settings', 'max')
    revalidateTag('global_site-settings', { expire: 0 })
    revalidateTag('translations-sitemap', { expire: 0 })
    revalidateTag('translation-runtime', { expire: 0 })
    revalidatePath('/(frontend)/[lang]', 'layout')
    for (const path of [
      '/pages-sitemap.xml',
      '/blogs-sitemap.xml',
      '/products-sitemap.xml',
    ])
      revalidatePath(path)
  }

  return doc
}
