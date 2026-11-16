import type React from 'react'
import { stripLocale } from '@/i18n/paths'
import { resolveLocalizedRedirect } from '@/utilities/i18n/resolveRedirect'
import type { Page, Post } from '@/payload-types'

import { getCachedDocument } from '@/utilities/getDocument'
import { getCachedRedirects } from '@/utilities/getRedirects'
import { resolveProductRedirect } from '@/utilities/products/resolveRedirect'
import { getContentPath } from '@/utilities/getContentPath'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound, permanentRedirect, redirect } from 'next/navigation'

interface Props {
  locale?: string
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({
  disableNotFound,
  url,
  locale = 'en',
}) => {
  const redirects = await getCachedRedirects()()

  const redirectItem = redirects.find((redirect) => redirect.from === stripLocale(url))

  if (redirectItem && locale !== 'en') {
    const payload = await getPayload({ config: configPromise })
    const destination = await resolveLocalizedRedirect(payload, redirectItem, locale)
    if (destination && destination.path !== url) {
      // User-approved installed public APIs: 307 for unavailable translations,
      // 308 for permanent document redirects; static /en normalization stays 301.
      if (destination.permanent) permanentRedirect(destination.path)
      redirect(destination.path)
    }
    if (disableNotFound) return null
    notFound()
  }

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    const reference = redirectItem.to?.reference
    if (reference) {
      const collection = reference.relationTo
      let document: { slug?: string | null } | null =
        typeof reference.value === 'object' ? reference.value : null

      if (collection === 'products' || collection === 'product-categories') {
        const payload = await getPayload({ config: configPromise })
        const path = await resolveProductRedirect(payload, reference)
        if (path && path !== url) permanentRedirect(path)
        if (disableNotFound) return null
        notFound()
      }

      if (collection === 'blogs') {
        // Cached relationships may contain an old populated slug. Resolve the stable
        // ID for every redirect so renames and publication changes take effect.
        const id = typeof reference.value === 'object' ? reference.value.id : reference.value
        const payload = await getPayload({ config: configPromise })
        document = await payload.findByID({
          collection: 'blogs',
          id,
          depth: 0,
          draft: false,
          overrideAccess: false,
          disableErrors: true,
          select: { slug: true },
        })
      } else if (typeof reference.value === 'string') {
        document = (await getCachedDocument(collection, reference.value)()) as Page | Post
      }

      const redirectUrl = getContentPath(collection, document?.slug || '')
      if (redirectUrl) {
        if (collection === 'blogs') permanentRedirect(redirectUrl)
        redirect(redirectUrl)
      }
    }
  }

  if (disableNotFound) return null

  notFound()
}
