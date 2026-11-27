import type { CollectionAfterChangeHook } from 'payload'

import { createRevalidation } from '@/plugins/translation/revalidate'

export const revalidateRedirects: CollectionAfterChangeHook = ({
  doc,
  req: { context, payload },
}) => {
  if (context.disableRevalidate) return doc
  payload.logger.info(`Revalidating redirects`)

  const cache = createRevalidation()
  cache.revalidateTag('redirects', 'max')

  const pending = cache.flush()
  return pending ? pending.then(() => doc) : doc
}
