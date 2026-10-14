import type { GlobalAfterChangeHook } from 'payload'

import { revalidatePath, revalidateTag } from 'next/cache'

export const revalidateSettings: GlobalAfterChangeHook = ({ doc, req: { context } }) => {
  if (!context.disableRevalidate) {
    revalidateTag('global_settings', 'max')
    revalidatePath('/blogs')
    revalidatePath('/blogs/[slug]', 'page')
    revalidatePath('/blogs/page/[pageNumber]', 'page')
    revalidatePath('/blogs/category/[categorySlug]', 'page')
    revalidatePath('/blogs/category/[categorySlug]/page/[pageNumber]', 'page')
  }

  return doc
}
