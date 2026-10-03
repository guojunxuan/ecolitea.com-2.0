import type React from 'react'
import type { Page, Post } from '@/payload-types'

import { getCachedDocument } from '@/utilities/getDocument'
import { getCachedRedirects } from '@/utilities/getRedirects'
import { getContentPath } from '@/utilities/getContentPath'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound, permanentRedirect, redirect } from 'next/navigation'

interface Props {
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()

  const redirectItem = redirects.find((redirect) => redirect.from === url)

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    const reference = redirectItem.to?.reference
    if (reference) {
      const collection = reference.relationTo
      let document: { slug?: string | null } | null =
        typeof reference.value === 'object' ? reference.value : null

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
